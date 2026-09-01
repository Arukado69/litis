/**
 * Documentos del expediente (motor puro, sin efectos y sin red).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO SE SOBRESCRIBE: SE SUBE OTRA VERSIÓN
 * ─────────────────────────────────────────────────────────────────────────────
 * Un escrito se corrige cuatro veces antes de presentarse. Si el archivo nuevo
 * pisa al anterior, el día que haya que demostrar qué se presentó —y con qué
 * anexos— ya no existe. En un juicio, el borrador y lo presentado son dos
 * documentos distintos y los dos importan por separado.
 *
 * Cada subida es una fila nueva con su versión. La ruta lleva un uuid propio,
 * así que dos versiones nunca comparten archivo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL NOMBRE DEL ARCHIVO NO DECIDE NADA
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo teclea quien sube, así que se sanea antes de usarlo en una ruta: sin
 * diagonales, sin `..`, sin caracteres que un sistema de archivos interprete.
 * Quien decide los permisos es el id del expediente, y ese lo pone el servidor.
 */

import type { TipoDocumento } from '@/types/db'

export interface Problema {
  campo: string
  mensaje: string
}

export const TIPO_DOCUMENTO_ETIQUETA: Record<TipoDocumento, string> = {
  escrito_inicial: 'Escrito inicial',
  promocion: 'Promoción',
  anexo: 'Anexo',
  acuse: 'Acuse sellado',
  acuerdo: 'Acuerdo',
  resolucion: 'Resolución',
  poder: 'Poder',
  identificacion: 'Identificación',
  prueba: 'Prueba',
  contrato: 'Contrato',
  otro: 'Otro',
}

const TIPOS = Object.keys(TIPO_DOCUMENTO_ETIQUETA) as TipoDocumento[]

/**
 * Tope de tamaño.
 *
 * Un escaneo de un expediente con anexos llega a pesar decenas de megas, así
 * que el tope tiene que ser generoso o la herramienta no sirve para el caso
 * real. Pero tiene que existir: sin él, una subida basta para llenar el disco
 * del servidor.
 */
export const TOPE_BYTES = 25 * 1024 * 1024

/**
 * Lo que se acepta.
 *
 * Un despacho sube PDF, escaneos y a veces un Word. Se deja fuera todo lo
 * ejecutable: aunque el bucket es privado y nada se ejecuta en el servidor, un
 * .exe o un .html guardados aquí solo pueden terminar en un problema de
 * seguridad para quien los abra del otro lado.
 */
export const MIMES_ACEPTADOS: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]

/**
 * Deja un nombre de archivo utilizable en una ruta.
 *
 * Quita acentos, cambia todo lo raro por guiones y recorta. **No** conserva
 * diagonales ni puntos consecutivos: `../../otro-despacho/x.pdf` tiene que
 * salir de aquí convertido en un nombre inofensivo.
 */
export function nombreSeguro(nombre: string): string {
  const sinAcentos = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()

  const limpio = sinAcentos
    .replace(/[^a-z0-9.]+/g, '-')
    // Puntos consecutivos incluyen el `..` de recorrido de directorios.
    .replace(/\.{2,}/g, '.')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80)

  return limpio.length > 0 ? limpio : 'documento'
}

/**
 * La ruta dentro del bucket: `{despacho}/{expediente}/{uuid}-{nombre}`.
 *
 * El expediente va en el SEGUNDO segmento porque de ahí lo leen las políticas
 * de Storage (migración `0010`). Cambiar el orden aquí sin cambiarlas allá
 * abriría los archivos de todos los despachos.
 */
export function rutaDeDocumento(args: {
  despachoId: string
  expedienteId: string
  identificador: string
  nombre: string
}): string {
  return `${args.despachoId}/${args.expedienteId}/${args.identificador}-${nombreSeguro(args.nombre)}`
}

export interface CapturaDocumento {
  tipo: TipoDocumento
  nombre: string
  notas: string | null
  visibleCliente: boolean
  /** De qué documento es el acuse sellado. */
  acuseDeId: string | null
}

function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

export function leerDocumento(
  campos: Record<string, string>,
  nombreArchivo: string,
): CapturaDocumento {
  const tipo = campos.tipo as TipoDocumento
  return {
    tipo: TIPOS.includes(tipo) ? tipo : 'otro',
    // Si no le pusieron nombre, se usa el del archivo: mejor
    // "demanda-inicial.pdf" que un campo vacío.
    nombre: texto(campos, 'nombre') ?? nombreArchivo,
    notas: texto(campos, 'notas'),
    visibleCliente: campos.visibleCliente === 'on',
    acuseDeId: texto(campos, 'acuseDeId'),
  }
}

export function validarArchivo(archivo: {
  nombre: string
  tamano: number
  mime: string
}): Problema[] {
  const problemas: Problema[] = []

  if (archivo.tamano === 0) {
    problemas.push({ campo: 'archivo', mensaje: 'El archivo llegó vacío.' })
    return problemas
  }

  if (archivo.tamano > TOPE_BYTES) {
    const megas = Math.round(TOPE_BYTES / (1024 * 1024))
    problemas.push({
      campo: 'archivo',
      mensaje: `El archivo pasa de ${megas} MB. Si es un escaneo, bájale la resolución o pártelo en anexos.`,
    })
  }

  if (!MIMES_ACEPTADOS.includes(archivo.mime)) {
    problemas.push({
      campo: 'archivo',
      mensaje: 'Ese tipo de archivo no se acepta. Sube PDF, imagen o documento de Word.',
    })
  }

  return problemas
}

/**
 * Qué versión le toca a un documento que se vuelve a subir.
 *
 * Se agrupa por nombre porque es lo que la persona reconoce: "la demanda" es la
 * demanda, aunque el archivo se llame distinto cada vez.
 */
export function siguienteVersion(
  nombre: string,
  existentes: readonly { nombre: string; version: number }[],
): number {
  const mismos = existentes.filter(
    (d) => d.nombre.trim().toLowerCase() === nombre.trim().toLowerCase(),
  )
  if (mismos.length === 0) return 1
  return Math.max(...mismos.map((d) => d.version)) + 1
}

/** "2.4 MB". Para la lista. */
export function tamanoLegible(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return ''
  const megas = bytes / (1024 * 1024)
  if (megas >= 1) return `${megas.toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

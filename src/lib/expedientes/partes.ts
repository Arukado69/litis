/**
 * Partes del expediente y el carácter con el que interviene el despacho.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO BASTA CON "CLIENTE" Y "CONTRAPARTE"
 * ─────────────────────────────────────────────────────────────────────────────
 * Tres razones operativas, no académicas:
 *
 *   1. El rol define el plazo. En amparo no es lo mismo ser quejoso que
 *      autoridad responsable: cambia cuándo surte efectos la notificación y,
 *      con ello, la fecha de vencimiento.
 *   2. El rol define el escrito. "Contestar" solo existe si eres demandado.
 *   3. La contraparte hay que guardarla aunque no sea cliente, porque es lo
 *      único que permite detectar un conflicto de interés antes de aceptar el
 *      siguiente asunto. Un despacho que solo registra a sus clientes no puede
 *      saber que está por demandar a uno de ellos.
 *
 * Por eso la contraparte y su abogado son registros de primera clase, no un
 * campo de texto en las notas.
 */

import type { IdMateria } from './materias'

export type TipoPersona = 'fisica' | 'moral'

export const TIPO_PERSONA_ETIQUETA: Record<TipoPersona, string> = {
  fisica: 'Persona física',
  moral: 'Persona moral',
}

/** Roles procesales. El conjunto aplicable depende de la materia. */
export type RolParte =
  // Civil, mercantil, familiar y administrativo
  | 'actor'
  | 'demandado'
  | 'tercero_llamado'
  | 'promovente'
  // Amparo
  | 'quejoso'
  | 'autoridad_responsable'
  | 'tercero_interesado'
  // Laboral
  | 'trabajador'
  | 'patron'
  | 'sindicato'
  // Penal
  | 'imputado'
  | 'victima'
  | 'ministerio_publico'
  // Administrativo y fiscal
  | 'autoridad_demandada'
  // Sucesorio
  | 'albacea'
  | 'heredero'

export const ROL_ETIQUETA: Record<RolParte, string> = {
  actor: 'Actor',
  demandado: 'Demandado',
  tercero_llamado: 'Tercero llamado a juicio',
  promovente: 'Promovente',
  quejoso: 'Quejoso',
  autoridad_responsable: 'Autoridad responsable',
  tercero_interesado: 'Tercero interesado',
  trabajador: 'Trabajador',
  patron: 'Patrón',
  sindicato: 'Sindicato',
  imputado: 'Imputado',
  victima: 'Víctima u ofendido',
  ministerio_publico: 'Ministerio Público',
  autoridad_demandada: 'Autoridad demandada',
  albacea: 'Albacea',
  heredero: 'Heredero o legatario',
}

/** Qué roles ofrecer al capturar una parte, según la materia del asunto. */
export const ROLES_POR_MATERIA: Record<IdMateria, readonly RolParte[]> = {
  civil: ['actor', 'demandado', 'tercero_llamado', 'albacea', 'heredero'],
  mercantil: ['actor', 'demandado', 'tercero_llamado'],
  familiar: ['promovente', 'actor', 'demandado', 'tercero_llamado'],
  laboral: ['trabajador', 'patron', 'sindicato', 'tercero_llamado'],
  penal: ['imputado', 'victima', 'ministerio_publico', 'tercero_llamado'],
  administrativo: ['actor', 'autoridad_demandada', 'tercero_interesado'],
  fiscal: ['actor', 'autoridad_demandada', 'tercero_interesado'],
  amparo: [
    'quejoso',
    'autoridad_responsable',
    'tercero_interesado',
    'ministerio_publico',
  ],
  corporativo: ['promovente'],
}

/** Con qué carácter interviene el despacho. */
export type CaracterDespacho =
  | 'apoderado'
  | 'abogado_patrono'
  | 'defensor'
  | 'asesor_juridico'
  | 'autorizado'
  | 'consultor'

export const CARACTER_ETIQUETA: Record<CaracterDespacho, string> = {
  apoderado: 'Apoderado legal',
  abogado_patrono: 'Abogado patrono',
  defensor: 'Defensor',
  asesor_juridico: 'Asesor jurídico de la víctima',
  autorizado: 'Autorizado para oír y recibir notificaciones',
  consultor: 'Consultor (sin representación)',
}

export interface Parte {
  id: string
  expedienteId: string
  rol: RolParte
  tipoPersona: TipoPersona
  nombre: string
  rfc: string | null
  curp: string | null
  /** Quién la representa del otro lado. Clave para el conflicto de interés. */
  abogadoContrario: string | null
  /**
   * Es la parte que representamos. Un expediente debe tener exactamente una
   * parte propia: sin ella no se sabe de qué lado se computan los plazos.
   */
  esNuestraParte: boolean
  notas: string | null
}

export interface ProblemaDePartes {
  campo: 'partes'
  mensaje: string
}

/**
 * Reglas mínimas de integridad de las partes de un expediente.
 *
 * No valida ortografía ni completitud: valida lo que, si está mal, hace que el
 * resto del sistema calcule mal. Sin parte propia no hay perspectiva desde la
 * cual computar un plazo; con dos, el sistema no sabe cuál usar.
 */
export function validarPartes(partes: readonly Parte[]): ProblemaDePartes[] {
  const problemas: ProblemaDePartes[] = []

  if (partes.length === 0) {
    problemas.push({
      campo: 'partes',
      mensaje: 'El expediente no tiene partes capturadas.',
    })
    return problemas
  }

  const propias = partes.filter((p) => p.esNuestraParte)
  if (propias.length === 0) {
    problemas.push({
      campo: 'partes',
      mensaje:
        'Ninguna parte está marcada como la que representa el despacho. Sin eso no se puede saber desde qué lado corren los plazos.',
    })
  } else if (propias.length > 1) {
    problemas.push({
      campo: 'partes',
      mensaje: `Hay ${propias.length} partes marcadas como propias. Debe ser exactamente una.`,
    })
  }

  const sinNombre = partes.filter((p) => p.nombre.trim().length === 0)
  if (sinNombre.length > 0) {
    problemas.push({
      campo: 'partes',
      mensaje: `Hay ${sinNombre.length} parte(s) sin nombre.`,
    })
  }

  return problemas
}

/** La parte que representamos, o `null` si no está definida. */
export function nuestraParte(partes: readonly Parte[]): Parte | null {
  return partes.find((p) => p.esNuestraParte) ?? null
}

/** Todas las que no son la nuestra. Incluye terceros, no solo la contraria. */
export function contrapartes(partes: readonly Parte[]): Parte[] {
  return partes.filter((p) => !p.esNuestraParte)
}

/**
 * Carátula del expediente al estilo del foro: "Actor vs. Demandado".
 * Si no hay dos partes con las que armarla, degrada al nombre disponible.
 */
export function caratula(partes: readonly Parte[]): string {
  const nuestra = nuestraParte(partes)
  const otras = contrapartes(partes)
  const primera = otras[0]

  if (nuestra && primera) return `${nuestra.nombre} vs. ${primera.nombre}`
  if (nuestra) return nuestra.nombre
  if (primera) return primera.nombre
  return 'Sin partes capturadas'
}

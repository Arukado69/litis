import { DATOS_QUE_SE_TRATAN } from '@/lib/legal/tratamiento'
import type { Database, RolMembresia } from '@/types/db'

/**
 * Llevarse el despacho completo en un archivo.
 *
 * Los términos de uso dicen que los datos son del despacho y que se entregan
 * «en formato legible por máquina y sin costo». Mientras eso fuera un trámite
 * manual, era una promesa que dependía de que alguien contestara un correo.
 * Esto la vuelve un botón.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ESTE ARCHIVO ES PURO
 * ─────────────────────────────────────────────────────────────────────────────
 * No lee la base ni el reloj: recibe las filas ya leídas y la fecha, y arma el
 * documento. Las consultas viven en `exportacion-datos.ts`. Así la parte que
 * decide QUÉ sale y QUÉ se tacha se puede probar entera sin Postgres.
 */

/** Una fila cualquiera, tal como sale de PostgREST. */
export type Fila = Record<string, unknown>

/**
 * Las tablas que se llevan, en orden de grafo: primero el despacho, luego su
 * gente, luego su padrón, luego los asuntos y lo que cuelga de ellos.
 *
 * ⚠️ **El orden importa para quien lo lea, no para el código.** Un archivo que
 * empieza por `actuaciones` obliga a saltar hacia adelante para entender de qué
 * expediente habla cada una. Este orden se puede recorrer de arriba abajo.
 */
export const TABLAS_EXPORTADAS = [
  'despachos',
  'perfiles',
  'membresias',
  'invitaciones',
  'personas',
  'organos',
  'calendarios',
  'dias_inhabiles',
  'plazos_catalogo',
  'regimenes_verificados',
  'expedientes',
  'expediente_partes',
  'expediente_etapas',
  'expediente_accesos',
  'actuaciones',
  'documentos',
  'audiencias',
  'plazos',
  'plazo_alertas_enviadas',
] as const

export type TablaExportada = (typeof TABLAS_EXPORTADAS)[number]

/**
 * ⚠️ **Toda tabla exportada tiene que existir en el esquema generado.**
 *
 * Sin esto, la lista de arriba sería un puñado de cadenas sueltas: el día que
 * una migración renombrara una tabla, la consulta fallaría en tiempo de
 * ejecución —o peor, devolvería vacío— y el archivo saldría con esa lista
 * vacía y cara de normal. Aquí lo caza el compilador, que es donde se caza
 * barato. `db.ts` se regenera con cada migración, así que esta afirmación se
 * evalúa contra el esquema vivo.
 */
type TablaDelEsquema = keyof Database['public']['Tables']
type _TodaTablaExiste = TablaExportada extends TablaDelEsquema ? true : never
const _tablasExisten: _TodaTablaExiste = true
void _tablasExisten

export type FilasPorTabla = Record<TablaExportada, readonly Fila[]>

/**
 * Lo que NO sale, y por qué.
 *
 * ⚠️ **El tachado se hace aquí, al armar, no en la consulta.** Si dependiera de
 * que cada `select` pidiera las columnas correctas, bastaría una consulta nueva
 * escrita con `select('*')` para que el secreto saliera en el archivo, y nadie
 * lo notaría: el archivo se ve bien. Al tacharlo en el armado, cualquier
 * columna que llegue de más se cae aquí.
 */
export const COLUMNAS_OMITIDAS: Partial<Record<TablaExportada, readonly string[]>> = {
  // Regla 14. Es la llave de un despacho entero, aunque vaya hasheada: un
  // archivo que alguien reenvía por correo no es lugar para la huella de una
  // credencial, y de todos modos no le sirve a quien se lleva sus datos.
  invitaciones: ['token_hash'],
}

/**
 * Lo que este archivo NO trae, dicho dentro del archivo.
 *
 * ⚠️ Va aquí adentro y no solo en la pantalla: quien abra el JSON dentro de seis
 * meses no va a tener la pantalla enfrente. Un export que parece completo y no
 * lo es se descubre el día que se necesita.
 */
export const NO_INCLUYE: readonly string[] = [
  'Los archivos de los documentos. Aquí va su ficha —nombre, tipo, versión, tamaño y ruta— pero no el contenido: el almacén es privado y los archivos se entregan a solicitud.',
  'El registro de eventos de cobro de Stripe (suscripcion_eventos). Es la bitácora interna del webhook y ninguna sesión puede leerla: no tiene política de lectura en la base.',
  'Los calendarios y el catálogo de plazos compartidos, que no son de ningún despacho. Aquí solo van las entradas propias, incluidas las que este despacho verificó o corrigió.',
  'Las contraseñas, que no las guarda este sistema: las administra el proveedor de autenticación.',
]

export type Exportacion = {
  /** Versión del formato, por si algún día cambia la forma. */
  formato: string
  generada_el: string
  generada_por: { perfil_id: string; nombre: string; correo: string }
  despacho: { id: string; nombre: string; slug: string }
  que_es: string
  no_incluye: readonly string[]
  columnas_omitidas: Partial<Record<TablaExportada, readonly string[]>>
  conteo: Record<TablaExportada, number>
  datos: FilasPorTabla
}

const QUE_ES =
  'Todo lo que este despacho tiene capturado, tal como está en la base, una lista por tabla. Las llaves entre tablas son las mismas columnas `*_id` que usa el sistema.'

/** Quita de una fila las columnas que no salen. */
function sanearFila(fila: Fila, omitidas: readonly string[]): Fila {
  if (omitidas.length === 0) return fila
  const salida: Fila = {}
  for (const [clave, valor] of Object.entries(fila)) {
    if (!omitidas.includes(clave)) salida[clave] = valor
  }
  return salida
}

/**
 * Arma el documento.
 *
 * El conteo se deriva de las filas, nunca se pasa aparte: un manifiesto que
 * dice «412 expedientes» sobre una lista de 400 es exactamente el tipo de
 * archivo que hace dudar de todo lo demás.
 */
export function armarExportacion({
  despacho,
  generadaPor,
  generadaEl,
  filas,
}: {
  despacho: { id: string; nombre: string; slug: string }
  generadaPor: { perfil_id: string; nombre: string; correo: string }
  generadaEl: string
  filas: FilasPorTabla
}): Exportacion {
  const datos = {} as Record<TablaExportada, readonly Fila[]>
  const conteo = {} as Record<TablaExportada, number>

  for (const tabla of TABLAS_EXPORTADAS) {
    const omitidas = COLUMNAS_OMITIDAS[tabla] ?? []
    const limpias = (filas[tabla] ?? []).map((f) => sanearFila(f, omitidas))
    datos[tabla] = limpias
    conteo[tabla] = limpias.length
  }

  return {
    formato: 'litis.exportacion.1',
    generada_el: generadaEl,
    generada_por: generadaPor,
    despacho,
    que_es: QUE_ES,
    no_incluye: NO_INCLUYE,
    columnas_omitidas: COLUMNAS_OMITIDAS,
    conteo,
    datos,
  }
}

/** Cuántas filas trae el archivo en total. Para decirlo en pantalla. */
export function totalDeFilas(exportacion: Exportacion): number {
  return Object.values(exportacion.conteo).reduce((suma, n) => suma + n, 0)
}

/**
 * `litis-despacho-perez-2026-09-14.json`
 *
 * Con la fecha adentro, dos descargas del mismo despacho no se pisan en la
 * carpeta de descargas — y se sabe de cuándo es cada una sin abrirlas.
 */
export function nombreDelArchivo(slug: string, generadaEl: string): string {
  const dia = generadaEl.slice(0, 10)
  const limpio = slug.replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'despacho'
  return `litis-${limpio}-${dia}.json`
}

/**
 * Las tablas que el aviso de privacidad declara que se tratan.
 *
 * ⚠️ **De aquí sale la prueba que amarra las dos cosas.** El aviso publica en
 * qué tabla vive cada grupo de datos; si el aviso declara una tabla que la
 * exportación no entrega, el despacho estaría pidiendo sus datos y recibiendo
 * menos de lo que se le dijo que hay. Una migración que agregue una tabla con
 * datos de una persona obliga a tocar las dos.
 */
export function tablasDeclaradasEnElAviso(): readonly string[] {
  return DATOS_QUE_SE_TRATAN.flatMap((grupo) =>
    grupo.donde.split(',').map((t) => t.trim()),
  )
}

// ── Quién la descarga ───────────────────────────────────────────────────────

/**
 * Solo el titular.
 *
 * ⚠️ **No es celo de permisos: es lo que hace que el archivo esté completo.**
 * La lectura corre con la sesión de quien pide, y `puede_ver_expediente`
 * (migración `0003`) solo le da al titular los expedientes restringidos que no
 * son suyos. Con la sesión de un abogado el archivo saldría sin esos y **sin
 * decirlo**: una lista a la que le faltan asuntos se ve igual de bien que una
 * completa, y quien se la lleve creerá que se llevó su despacho.
 *
 * La alternativa —leer con clave de servicio para que cualquiera exportara
 * todo— metería un camino que salta la RLS entera en una pantalla que descarga
 * el despacho completo. No vale la comodidad.
 */
export function puedeExportar(rol: RolMembresia): boolean {
  return rol === 'titular'
}

/** Por qué se le niega a los demás. Vive aquí para decirlo igual en los dos lados. */
export const PORQUE_SOLO_TITULAR =
  'La descarga la hace el titular del despacho. No es celo de permisos: con otro papel el archivo saldría sin los expedientes restringidos de otras personas y sin decirlo, que es peor que no tenerlo.'

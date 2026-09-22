import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'
import type { Database } from '@/types/db'

import {
  TABLAS_EXPORTADAS,
  recolectarPaginas,
  type Fila,
  type FilasPorTabla,
  type TablaExportada,
} from './exportacion'

/**
 * Las consultas de la exportación.
 *
 * Corren con la SESIÓN de quien pide, nunca con clave de servicio. Eso importa
 * más de lo que parece: la RLS sigue siendo quien decide, así que este camino
 * no puede sacar nada que esa persona no pudiera ver de todos modos.
 *
 * ⚠️ **Por eso la exportación es del titular.** `puede_ver_expediente`
 * (migración `0003`) le da al titular TODOS los expedientes del despacho,
 * incluidos los restringidos que no son suyos; a un abogado no. Con la sesión
 * de un abogado el archivo saldría incompleto **y sin decirlo**: una lista de
 * expedientes a la que le faltan los restringidos de otros se ve igual de bien
 * que una completa. Entre un permiso estrecho y un archivo que miente por
 * omisión, el permiso estrecho.
 */

/**
 * Cuántas filas se piden por página.
 *
 * ⚠️ **PostgREST corta en 1000 filas y no avisa.** Sin paginar, el despacho con
 * 1200 actuaciones se descarga 1000 y cree que ese es su despacho. Es el mismo
 * error de fondo que la `0008` sin aplicar: algo que se ve bien y está
 * incompleto.
 *
 * ⚠️ Es lo que se PIDE, no lo que llega. El proyecto puede tener un tope de
 * filas más bajo (`Max rows` en los ajustes de la API), y entonces cada página
 * devuelve menos de esto sin que sea el final.
 */
const PAGINA = 1000

/**
 * Cuántos ids por consulta.
 *
 * Un `.in()` viaja en la URL, y la URL tiene largo máximo. Con 3000 expedientes
 * de 36 caracteres cada uno son más de 100 KB en una línea: el servidor la
 * rechaza mucho antes.
 *
 * ⚠️ **80 y no 200.** Cada uuid entrecomillado gasta ~39 caracteres, así que
 * 200 ids son casi 8 KB solo de filtro — justo en el límite de línea de
 * petición que traen por omisión los proxys que van delante de PostgREST. El
 * despacho al que le reventaría es el más grande, que es el que más necesita
 * llevarse sus datos. 80 deja margen de sobra y cuesta unas consultas más.
 */
const LOTE_IDS = 80

/** Las columnas que existen de verdad en esa tabla, según el esquema generado. */
type ColumnaDe<T extends TablaExportada> = keyof Database['public']['Tables'][T]['Row'] &
  string

/**
 * Por qué columnas se ordena cada tabla al paginar.
 *
 * ⚠️ **Paginar sin orden estable pierde filas.** `.range()` corta sobre el orden
 * que devuelva Postgres, y sin `order by` ese orden no está garantizado entre
 * una página y la siguiente: una fila puede salir dos veces y otra ninguna. En
 * un archivo que el despacho se lleva porque se va, eso no se puede permitir.
 *
 * ⚠️ **Están las 19 escritas, sin valor por omisión, a propósito.**
 * `expediente_accesos` NO tiene columna `id` —su llave es compuesta
 * (`expediente_id`, `perfil_id`)— así que un `order('id')` por omisión no es un
 * detalle de estilo: revienta esa consulta y con ella la exportación entera.
 * Con el tipo `ColumnaDe<T>`, escribir una columna que no existe no compila, y
 * una tabla nueva obliga a decidir su orden en vez de heredar uno que podría no
 * servirle.
 */
const ORDEN: { [T in TablaExportada]: readonly ColumnaDe<T>[] } = {
  despachos: ['id'],
  perfiles: ['id'],
  membresias: ['id'],
  invitaciones: ['id'],
  personas: ['id'],
  organos: ['id'],
  calendarios: ['id'],
  dias_inhabiles: ['id'],
  plazos_catalogo: ['id'],
  regimenes_verificados: ['id'],
  expedientes: ['id'],
  expediente_partes: ['id'],
  expediente_etapas: ['id'],
  expediente_accesos: ['expediente_id', 'perfil_id'],
  actuaciones: ['id'],
  documentos: ['id'],
  audiencias: ['id'],
  plazos: ['id'],
  plazo_alertas_enviadas: ['id'],
}

/**
 * Por qué columna se filtra cada tabla.
 *
 * ⚠️ **Está aquí y no suelto en cada llamada porque así lo revisa el
 * compilador.** `.eq()` y `.in()` de supabase-js reciben la columna con tipos
 * condicionales que no admiten un genérico, así que en la llamada el nombre
 * viaja como cadena y un `despacho` por `despacho_id` no lo cazaría nada: la
 * consulta fallaría en producción, con el despacho esperando su archivo. En
 * este mapa, `ColumnaDe<T>` obliga a que la columna exista en esa tabla.
 *
 * `perfiles` se filtra por `id` porque sus llaves salen de `membresias`; las
 * hijas de expediente, por `expediente_id`; el registro de avisos, por
 * `plazo_id`.
 */
const FILTRO: { [T in TablaExportada]: ColumnaDe<T> } = {
  despachos: 'id',
  perfiles: 'id',
  membresias: 'despacho_id',
  invitaciones: 'despacho_id',
  personas: 'despacho_id',
  organos: 'despacho_id',
  calendarios: 'despacho_id',
  dias_inhabiles: 'calendario_id',
  plazos_catalogo: 'despacho_id',
  regimenes_verificados: 'despacho_id',
  expedientes: 'despacho_id',
  expediente_partes: 'expediente_id',
  expediente_etapas: 'expediente_id',
  expediente_accesos: 'expediente_id',
  actuaciones: 'expediente_id',
  documentos: 'expediente_id',
  audiencias: 'expediente_id',
  plazos: 'expediente_id',
  plazo_alertas_enviadas: 'plazo_id',
}

type Respuesta = { data: Fila[] | null; error: { message: string } | null }

function enLotes<T>(items: readonly T[], tamano: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < items.length; i += tamano) {
    lotes.push(items.slice(i, i + tamano))
  }
  return lotes
}

/**
 * Corre una consulta hasta agotarla.
 *
 * ⚠️ **Un error NO devuelve lo que alcanzó a leer: lanza.** Devolver lo parcial
 * dejaría un archivo con menos expedientes de los que hay, con cara de estar
 * completo. Que la descarga falle es incómodo; que entregue un despacho a
 * medias sin decirlo es de otra categoría.
 */
async function paginar(
  etiqueta: TablaExportada,
  consulta: (desde: number, hasta: number) => PromiseLike<Respuesta>,
): Promise<Fila[]> {
  return recolectarPaginas(async (desde, hasta) => {
    const { data, error } = await consulta(desde, hasta)
    if (error) {
      throw new Error(`No se pudo leer ${etiqueta}: ${error.message}`)
    }
    return data ?? []
  }, PAGINA)
}

/** Los ids de una lista de filas, sin nulos. */
function ids(filas: readonly Fila[], columna = 'id'): string[] {
  return filas.flatMap((f) => {
    const valor = f[columna]
    return typeof valor === 'string' ? [valor] : []
  })
}

/**
 * Todo lo del despacho, tabla por tabla.
 *
 * El recorrido es un grafo, no una lista: del despacho salen su gente y su
 * padrón; de los expedientes salen las partes, las etapas, la bitácora, los
 * documentos, las audiencias y los plazos; de los plazos, el registro de
 * avisos. Cada nivel se consulta con los ids del anterior.
 *
 * ⚠️ Sin joins de PostgREST, a propósito: un join anidado de seis niveles
 * depende de los metadatos de relaciones y se cae de formas difíciles de leer.
 * Aquí son consultas planas que se pueden correr a mano para comprobar una
 * cuenta que no cuadre.
 */
export async function leerDespachoCompleto(
  despachoId: string,
): Promise<FilasPorTabla> {
  const supabase = await clienteServidor()

  /** Una tabla filtrada por una columna igual a un valor. */
  const porColumna = (tabla: TablaExportada, valor: string) =>
    paginar(tabla, (desde, hasta) => {
      // Los dos casts son del mismo tipo y de la misma naturaleza: el genérico
      // de supabase-js exige UNA tabla concreta, no una unión, y con ella una
      // de sus columnas. Que la tabla exista lo fija `exportacion.ts`; que la
      // columna exista EN ESA tabla lo fija `FILTRO`. Aquí ya está comprobado.
      let consulta = supabase
        .from(tabla as 'expedientes')
        .select('*')
        .eq(FILTRO[tabla] as 'id', valor)
      for (const col of ORDEN[tabla]) consulta = consulta.order(col)
      return consulta.range(desde, hasta).then((r) => r as unknown as Respuesta)
    })

  /** Una tabla hija, por los ids de su padre, en lotes. */
  const porIds = async (tabla: TablaExportada, llaves: string[]) => {
    if (llaves.length === 0) return []
    const filas: Fila[] = []
    for (const lote of enLotes(llaves, LOTE_IDS)) {
      const parte = await paginar(tabla, (desde, hasta) => {
        let consulta = supabase
          .from(tabla as 'expedientes')
          .select('*')
          .in(FILTRO[tabla] as 'id', lote)
        for (const col of ORDEN[tabla]) consulta = consulta.order(col)
        return consulta.range(desde, hasta).then((r) => r as unknown as Respuesta)
      })
      filas.push(...parte)
    }
    return filas
  }

  // ── Nivel 1: el despacho y su gente ──────────────────────────────────────
  const despachos = await porColumna('despachos', despachoId)

  const membresias = await porColumna('membresias', despachoId)
  const perfiles = await porIds('perfiles', ids(membresias, 'perfil_id'))
  const invitaciones = await porColumna('invitaciones', despachoId)
  const personas = await porColumna('personas', despachoId)
  const organos = await porColumna('organos', despachoId)

  // Solo los calendarios PROPIOS: los compartidos (`despacho_id is null`) son
  // la semilla del sistema y no son de este despacho.
  const calendarios = await porColumna('calendarios', despachoId)
  const dias_inhabiles = await porIds('dias_inhabiles', ids(calendarios))

  const plazos_catalogo = await porColumna('plazos_catalogo', despachoId)
  const regimenes_verificados = await porColumna('regimenes_verificados', despachoId)

  // ── Nivel 2: los asuntos ─────────────────────────────────────────────────
  const expedientes = await porColumna('expedientes', despachoId)
  const expedienteIds = ids(expedientes)

  const expediente_partes = await porIds('expediente_partes', expedienteIds)
  const expediente_etapas = await porIds('expediente_etapas', expedienteIds)
  const expediente_accesos = await porIds('expediente_accesos', expedienteIds)
  const actuaciones = await porIds('actuaciones', expedienteIds)
  const documentos = await porIds('documentos', expedienteIds)
  const audiencias = await porIds('audiencias', expedienteIds)
  const plazos = await porIds('plazos', expedienteIds)

  // ── Nivel 3: el registro de avisos ───────────────────────────────────────
  const plazo_alertas_enviadas = await porIds('plazo_alertas_enviadas', ids(plazos))

  const filas: FilasPorTabla = {
    despachos,
    perfiles,
    membresias,
    invitaciones,
    personas,
    organos,
    calendarios,
    dias_inhabiles,
    plazos_catalogo,
    regimenes_verificados,
    expedientes,
    expediente_partes,
    expediente_etapas,
    expediente_accesos,
    actuaciones,
    documentos,
    audiencias,
    plazos,
    plazo_alertas_enviadas,
  }

  // Si alguna tabla nueva entra a `TABLAS_EXPORTADAS` y nadie la consulta aquí,
  // saldría como `undefined` y el archivo la enseñaría vacía. Mejor reventar.
  for (const tabla of TABLAS_EXPORTADAS) {
    if (!filas[tabla]) {
      throw new Error(`La exportación declara ${tabla} pero nadie la consulta.`)
    }
  }

  return filas
}

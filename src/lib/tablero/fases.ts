/**
 * El tablero de etapas (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL PROBLEMA: CADA VÍA TIENE SUS PROPIAS ETAPAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Un ordinario mercantil pasa por emplazamiento, contestación, pruebas,
 * alegatos y sentencia. Un amparo indirecto por admisión, informes justificados
 * y audiencia constitucional. Un sucesorio por cuatro secciones. No hay un
 * juego de columnas que le quede a los tres.
 *
 * Hay dos salidas y solo una sirve:
 *
 *   ✗ Un tablero por vía. Correcto y también inútil: un litigante lleva
 *     mercantil, laboral y amparo a la vez, y lo que quiere ver es su cartera
 *     completa, no ir cambiando de pestaña para contarla en tres pedazos.
 *
 *   ✓ Columnas universales, etiqueta real en la tarjeta. Las seis fases de
 *     abajo son la forma que tiene cualquier proceso judicial mexicano;
 *     debajo del nombre del asunto va SIEMPRE su etapa de verdad
 *     ("Audiencia constitucional", no "Instrucción"). La columna sirve para
 *     comparar la cartera; la etiqueta, para saber qué toca.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ LA MISMA CLAVE NO SIEMPRE SIGNIFICA LO MISMO
 * ─────────────────────────────────────────────────────────────────────────────
 * `revision` en amparo es el **recurso de revisión** —una impugnación—, y en un
 * asunto corporativo es la **revisión del documento** antes de entregarlo. La
 * misma palabra, dos fases opuestas del trabajo. Por eso el mapa admite
 * excepciones por vía: sin ellas, un dictamen a punto de entregarse aparecería
 * en la columna de impugnaciones.
 */

export type IdFase =
  | 'preparacion'
  | 'presentacion'
  | 'instruccion'
  | 'resolucion'
  | 'impugnacion'
  | 'ejecucion'

export interface Fase {
  id: IdFase
  nombre: string
  /** Qué está pasando ahí, para quien no lo tiene en la punta de la lengua. */
  descripcion: string
}

export const FASES: readonly Fase[] = [
  {
    id: 'preparacion',
    nombre: 'Preparación',
    descripcion: 'Todavía no hay juicio: se integra el expediente.',
  },
  {
    id: 'presentacion',
    nombre: 'Presentación',
    descripcion: 'Se presentó y se espera —o ya llegó— el auto de admisión.',
  },
  {
    id: 'instruccion',
    nombre: 'Instrucción',
    descripcion: 'Se fija la litis y se desahogan pruebas. Es la etapa larga.',
  },
  {
    id: 'resolucion',
    nombre: 'Resolución',
    descripcion: 'Alegatos, citación y sentencia.',
  },
  {
    id: 'impugnacion',
    nombre: 'Impugnación',
    descripcion: 'Apelación, revisión o amparo contra lo resuelto.',
  },
  {
    id: 'ejecucion',
    nombre: 'Ejecución',
    descripcion: 'Cumplimiento, remate, adjudicación.',
  },
]

/** Dónde cae cada etapa, en general. */
const FASE_POR_ETAPA: Record<string, IdFase> = {
  // Preparación
  preparacion: 'preparacion',
  solicitud: 'preparacion',
  informacion: 'preparacion',
  elaboracion: 'preparacion',
  // La conciliación prejudicial obligatoria en materia laboral pasa ANTES de
  // que exista juicio: es requisito de procedibilidad, no una etapa del
  // proceso. Ponerla en "Presentación" haría creer que ya se demandó.
  conciliacion_prejudicial: 'preparacion',
  // Presentación
  demanda: 'presentacion',
  denuncia: 'presentacion',
  admision: 'presentacion',
  auto_exequendo: 'presentacion',
  // El requerimiento de pago y embargo del ejecutivo va junto con el auto de
  // exequendo: es la diligencia con la que arranca el juicio.
  requerimiento_embargo: 'presentacion',
  // Instrucción
  contestacion: 'instruccion',
  ampliacion: 'instruccion',
  informes: 'instruccion',
  audiencia_previa: 'instruccion',
  audiencia_preliminar: 'instruccion',
  audiencia_juicio: 'instruccion',
  audiencia_constitucional: 'instruccion',
  pruebas: 'instruccion',
  pruebas_ofrecimiento: 'instruccion',
  pruebas_desahogo: 'instruccion',
  tramite: 'instruccion',
  // Las cuatro secciones de un sucesorio no son "prueba", pero sí son la
  // sustanciación larga del asunto: es donde de verdad están.
  seccion_primera: 'instruccion',
  seccion_segunda: 'instruccion',
  seccion_tercera: 'instruccion',
  seccion_cuarta: 'instruccion',
  // Resolución
  alegatos: 'resolucion',
  cierre: 'resolucion',
  citacion_sentencia: 'resolucion',
  sentencia: 'resolucion',
  resolucion: 'resolucion',
  entrega: 'resolucion',
  formalizacion: 'resolucion',
  concluido: 'resolucion',
  // Impugnación
  apelacion: 'impugnacion',
  revision: 'impugnacion',
  amparo_directo: 'impugnacion',
  impugnacion: 'impugnacion',
  // Ejecución
  ejecucion: 'ejecucion',
  cumplimiento: 'ejecucion',
  remate: 'ejecucion',
  adjudicacion: 'ejecucion',
}

/**
 * Excepciones por vía. Ver el encabezado: la misma clave puede significar
 * cosas opuestas según el asunto.
 */
const EXCEPCIONES: Record<string, IdFase> = {
  // En un asunto corporativo, "revisión" es revisar el documento antes de
  // entregarlo, no un recurso.
  'corp.asunto:revision': 'resolucion',
}

/** En qué fase cae una etapa. `null` cuando el expediente no tiene etapa. */
export function faseDeEtapa(via: string, clave: string | null): IdFase | null {
  if (!clave) return null
  return EXCEPCIONES[`${via}:${clave}`] ?? FASE_POR_ETAPA[clave] ?? null
}

export interface ExpedienteEnTablero {
  id: string
  numeroInterno: string
  numeroOrgano: string | null
  caratula: string
  via: string
  viaNombre: string
  etapaClave: string | null
  /** El nombre REAL de la etapa. Es lo que va en la tarjeta. */
  etapaNombre: string | null
  estado: string
  responsableNombre: string | null
  /** Las que corren en paralelo: suspensión, incidentes. */
  paralelas: readonly string[]
  /** Plazos corriendo. Un asunto sin movimiento no es lo mismo que uno tranquilo. */
  plazosVivos: number
  /** El vencimiento más cercano, si hay. */
  proximoVencimiento: string | null
  /** Cuándo se movió por última vez. Para detectar los estancados. */
  actualizadoEl: string
}

export interface Columna {
  fase: Fase
  expedientes: readonly ExpedienteEnTablero[]
}

export interface Tablero {
  columnas: readonly Columna[]
  /**
   * Los que no tienen etapa capturada. Van APARTE y arriba, no repartidos en
   * "Preparación": "no sé en qué va" es un estado real del despacho, y
   * esconderlo dentro de una columna legítima lo vuelve invisible justo cuando
   * hay que arreglarlo.
   */
  sinEtapa: readonly ExpedienteEnTablero[]
  /** Con etapa que el mapa no reconoce. Casi siempre, una etapa capturada a mano. */
  sinFase: readonly ExpedienteEnTablero[]
  total: number
}

export function armarTablero(
  expedientes: readonly ExpedienteEnTablero[],
): Tablero {
  const porFase = new Map<IdFase, ExpedienteEnTablero[]>()
  for (const f of FASES) porFase.set(f.id, [])

  const sinEtapa: ExpedienteEnTablero[] = []
  const sinFase: ExpedienteEnTablero[] = []

  for (const e of expedientes) {
    if (!e.etapaClave) {
      sinEtapa.push(e)
      continue
    }
    const fase = faseDeEtapa(e.via, e.etapaClave)
    if (!fase) {
      sinFase.push(e)
      continue
    }
    porFase.get(fase)?.push(e)
  }

  return {
    columnas: FASES.map((fase) => ({
      fase,
      expedientes: ordenar(porFase.get(fase.id) ?? []),
    })),
    sinEtapa: ordenar(sinEtapa),
    sinFase: ordenar(sinFase),
    total: expedientes.length,
  }
}

/**
 * Dentro de la columna, primero lo que aprieta.
 *
 * Un asunto con un plazo corriendo pide atención antes que uno que solo espera
 * un acuerdo, aunque los dos estén en la misma fase. Entre los que no tienen
 * plazo, primero el que lleva más tiempo sin moverse: ese es el que se está
 * durmiendo.
 */
function ordenar(lista: ExpedienteEnTablero[]): ExpedienteEnTablero[] {
  return [...lista].sort((a, b) => {
    if (a.proximoVencimiento && b.proximoVencimiento) {
      return a.proximoVencimiento.localeCompare(b.proximoVencimiento)
    }
    if (a.proximoVencimiento) return -1
    if (b.proximoVencimiento) return 1
    return a.actualizadoEl.localeCompare(b.actualizadoEl)
  })
}

/** Días naturales sin que el expediente se mueva. */
export function diasSinMoverse(
  expediente: ExpedienteEnTablero,
  hoy: string,
): number {
  const desde = Date.parse(`${expediente.actualizadoEl.slice(0, 10)}T00:00:00Z`)
  const hasta = Date.parse(`${hoy}T00:00:00Z`)
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return 0
  return Math.max(0, Math.round((hasta - desde) / 86_400_000))
}

/** A partir de aquí, un asunto sin movimiento merece una mirada. */
export const DIAS_PARA_ESTANCADO = 60

/**
 * Los que llevan mucho sin moverse Y sin ningún plazo corriendo.
 *
 * Los dos filtros juntos importan: un asunto con un término encima no está
 * estancado aunque su etapa lleve meses igual —está esperando, que es
 * distinto—. El que preocupa es el que no tiene nada corriendo y nadie ha
 * tocado: ese es el que se cae por caducidad.
 */
export function estancados(
  expedientes: readonly ExpedienteEnTablero[],
  hoy: string,
  umbral = DIAS_PARA_ESTANCADO,
): ExpedienteEnTablero[] {
  return expedientes
    .filter((e) => e.plazosVivos === 0 && diasSinMoverse(e, hoy) >= umbral)
    .sort((a, b) => a.actualizadoEl.localeCompare(b.actualizadoEl))
}

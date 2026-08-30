/**
 * Apertura de expediente (motor puro, sin efectos).
 *
 * Convierte lo que se captura en la pantalla de alta en el grafo de filas que
 * hay que insertar: el expediente, sus partes y sus etapas clonadas. La Server
 * Action se queda con lo que sí necesita base de datos —leer el consecutivo,
 * escribir— y todo el criterio vive aquí, donde se puede probar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL NÚMERO INTERNO SE CALCULA Y NO SE PIDE
 * ─────────────────────────────────────────────────────────────────────────────
 * Es el identificador con el que el despacho habla del asunto en voz alta
 * ("el 2026-014"), y existe desde antes de que el juzgado asigne el suyo.
 * Pedírselo al usuario garantiza dos cosas: que se repita, y que cada quien
 * invente su formato. Se calcula por año para que el consecutivo no crezca
 * indefinidamente y para que el número diga de entrada de qué año es el asunto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ SE BLOQUEA Y QUÉ SOLO SE ADVIERTE
 * ─────────────────────────────────────────────────────────────────────────────
 * Se BLOQUEA lo que dejaría al sistema calculando mal: sin vía no hay régimen
 * de cómputo, sin parte propia no se sabe desde qué lado corren los plazos.
 *
 * Se ADVIERTE lo que falta pero se puede completar después: el número del
 * órgano, que no existe hasta que se admite la demanda, o el órgano mismo. Un
 * alta que exija esos datos obliga a inventarlos, y un dato inventado en el
 * expediente es peor que un campo vacío.
 */

import { etapasDeVia, tienePlantillaPropia } from './etapas'
import { buscarVia, MATERIAS, type Fuero, type IdMateria } from './materias'
import { validarPartes, caratula as armarCaratula, type Parte } from './partes'

/** Una parte tal como se captura, antes de existir en la base. */
export interface ParteCaptura {
  personaId: string
  nombre: string
  rol: string
  esNuestraParte: boolean
  abogadoContrario?: string | null
  notas?: string | null
}

export interface DatosApertura {
  despachoId: string
  materia: IdMateria
  /** Id de vía, p. ej. `merc.ejecutivo`. */
  via: string
  fuero: Fuero
  entidad?: string | null
  organoId?: string | null
  numeroOrgano?: string | null
  clientePersonaId?: string | null
  responsableId?: string | null
  /** Si viene vacía, se arma con las partes. */
  caratula?: string | null
  instancia?: string | null
  cuantia?: number | null
  restringido?: boolean
  fechaInicio?: string | null
  notas?: string | null
  partes: readonly ParteCaptura[]
}

export interface Problema {
  campo: string
  mensaje: string
}

export interface EtapaNueva {
  clave: string
  nombre: string
  descripcion: string | null
  orden: number
  paralela: boolean
}

export interface PlanDeApertura {
  expediente: {
    despachoId: string
    numeroInterno: string
    numeroOrgano: string | null
    caratula: string
    clientePersonaId: string | null
    materia: IdMateria
    via: string
    fuero: Fuero
    entidad: string | null
    organoId: string | null
    instancia: string | null
    etapaActual: string | null
    cuantia: number | null
    responsableId: string | null
    restringido: boolean
    fechaInicio: string | null
    notas: string | null
  }
  partes: readonly ParteCaptura[]
  etapas: readonly EtapaNueva[]
  /** No impiden el alta; se muestran para que alguien las atienda. */
  advertencias: readonly string[]
}

export type ResultadoApertura =
  | { ok: true; plan: PlanDeApertura }
  | { ok: false; problemas: readonly Problema[] }

// ---------------------------------------------------------------------------
// Número interno
// ---------------------------------------------------------------------------

const PATRON_NUMERO = /^(\d{4})-(\d{3,})$/

/**
 * El siguiente consecutivo del año: `2026-001`, `2026-002`…
 *
 * Recibe los números que ya existen en el despacho. Ignora los que no siguen el
 * formato en vez de tronar: si alguien capturó "EXP-VIEJO-3" durante una
 * migración, eso no debe impedir abrir un expediente hoy.
 *
 * Toma el MÁXIMO y le suma uno; no busca huecos. Reutilizar el número de un
 * expediente borrado haría que dos asuntos distintos compartan identificador en
 * los archiveros de papel y en la memoria del equipo.
 */
export function siguienteNumeroInterno(
  existentes: readonly string[],
  anio: number,
): string {
  let mayor = 0

  for (const numero of existentes) {
    const m = PATRON_NUMERO.exec(numero.trim())
    if (!m) continue
    if (Number(m[1]) !== anio) continue
    const consecutivo = Number(m[2])
    if (consecutivo > mayor) mayor = consecutivo
  }

  return `${anio}-${String(mayor + 1).padStart(3, '0')}`
}

// ---------------------------------------------------------------------------
// Clonado de etapas
// ---------------------------------------------------------------------------

/**
 * Copia las etapas de la plantilla de la vía. A partir de aquí son del
 * expediente: renombrarlas o quitarlas no toca a ningún otro asunto.
 */
export function clonarEtapas(via: string): EtapaNueva[] {
  return etapasDeVia(via).map((etapa, indice) => ({
    clave: etapa.id,
    nombre: etapa.nombre,
    descripcion: etapa.descripcion ?? null,
    orden: indice + 1,
    paralela: etapa.paralela ?? false,
  }))
}

/**
 * La etapa en la que nace el expediente: la primera del hilo principal.
 * Nunca una paralela — un asunto no arranca en el incidente de suspensión.
 */
export function etapaInicial(etapas: readonly EtapaNueva[]): string | null {
  return etapas.find((e) => !e.paralela)?.clave ?? null
}

// ---------------------------------------------------------------------------
// Validación
// ---------------------------------------------------------------------------

/** Adapta la captura a la forma que espera `validarPartes`. */
function comoPartes(partes: readonly ParteCaptura[]): Parte[] {
  return partes.map((p, i) => ({
    id: `captura-${i}`,
    expedienteId: '',
    rol: p.rol as Parte['rol'],
    tipoPersona: 'fisica',
    nombre: p.nombre,
    rfc: null,
    curp: null,
    abogadoContrario: p.abogadoContrario ?? null,
    esNuestraParte: p.esNuestraParte,
    notas: p.notas ?? null,
  }))
}

export function validarApertura(datos: DatosApertura): Problema[] {
  const problemas: Problema[] = []

  if (!datos.despachoId) {
    problemas.push({ campo: 'despachoId', mensaje: 'Falta el despacho.' })
  }

  if (!MATERIAS[datos.materia]) {
    problemas.push({
      campo: 'materia',
      mensaje: `Materia desconocida: ${datos.materia}.`,
    })
  }

  const via = buscarVia(datos.via)
  if (!via) {
    // Sin vía no hay régimen de cómputo, y sin régimen no se puede calcular un
    // solo plazo. Es lo primero que se bloquea.
    problemas.push({
      campo: 'via',
      mensaje: `Vía desconocida: ${datos.via}. Sin vía no se pueden computar plazos.`,
    })
  } else {
    if (via.materia !== datos.materia) {
      problemas.push({
        campo: 'via',
        mensaje: `La vía "${via.nombre}" no corresponde a la materia ${MATERIAS[datos.materia]?.nombre ?? datos.materia}.`,
      })
    }
    if (!via.fueros.includes(datos.fuero)) {
      problemas.push({
        campo: 'fuero',
        mensaje: `La vía "${via.nombre}" no se tramita en fuero ${datos.fuero === 'federal' ? 'federal' : 'común'}.`,
      })
    }
  }

  for (const problema of validarPartes(comoPartes(datos.partes))) {
    problemas.push({ campo: 'partes', mensaje: problema.mensaje })
  }

  return problemas
}

function reunirAdvertencias(
  datos: DatosApertura,
  etapas: readonly EtapaNueva[],
): string[] {
  const advertencias: string[] = []

  if (!datos.organoId) {
    advertencias.push(
      'No se capturó el órgano. Sin él, el cómputo de plazos usará el calendario por omisión del despacho y no el del tribunal, que puede tener otras vacaciones.',
    )
  }
  if (!datos.numeroOrgano) {
    advertencias.push(
      'Sin número de expediente del órgano. Es normal antes de la admisión; captúralo en cuanto se admita.',
    )
  }
  if (!datos.responsableId) {
    advertencias.push(
      'Sin abogado responsable. Los plazos de este expediente no tendrán a quién avisarle.',
    )
  }
  if (!datos.clientePersonaId) {
    advertencias.push(
      'Sin cliente ligado. El expediente no aparecerá en ningún portal de cliente.',
    )
  }
  if (!tienePlantillaPropia(datos.via)) {
    advertencias.push(
      `La vía no tiene plantilla de etapas propia: se usó la genérica de ${etapas.length} etapas. Ajústala a mano para que el tablero sirva.`,
    )
  }

  return advertencias
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------

/**
 * Arma el plan completo de alta, o devuelve los problemas que lo impiden.
 *
 * @param numerosExistentes números internos ya usados en el despacho.
 * @param anio             año del consecutivo; se pasa para no leer el reloj.
 */
export function prepararApertura(args: {
  datos: DatosApertura
  numerosExistentes: readonly string[]
  anio: number
}): ResultadoApertura {
  const { datos, numerosExistentes, anio } = args

  const problemas = validarApertura(datos)
  if (problemas.length > 0) return { ok: false, problemas }

  const etapas = clonarEtapas(datos.via)
  const caratula =
    datos.caratula?.trim() || armarCaratula(comoPartes(datos.partes))

  return {
    ok: true,
    plan: {
      expediente: {
        despachoId: datos.despachoId,
        numeroInterno: siguienteNumeroInterno(numerosExistentes, anio),
        numeroOrgano: datos.numeroOrgano?.trim() || null,
        caratula,
        clientePersonaId: datos.clientePersonaId ?? null,
        materia: datos.materia,
        via: datos.via,
        fuero: datos.fuero,
        entidad: datos.entidad ?? null,
        organoId: datos.organoId ?? null,
        instancia: datos.instancia?.trim() || null,
        etapaActual: etapaInicial(etapas),
        cuantia: datos.cuantia ?? null,
        responsableId: datos.responsableId ?? null,
        restringido: datos.restringido ?? false,
        fechaInicio: datos.fechaInicio ?? null,
        notas: datos.notas?.trim() || null,
      },
      partes: datos.partes,
      etapas,
      advertencias: reunirAdvertencias(datos, etapas),
    },
  }
}

/**
 * Calendario de días inhábiles y aritmética de días hábiles.
 *
 * POR QUÉ ES UNA TABLA Y NO CÓDIGO: no existe "el" calendario de inhábiles en
 * México. Conviven al menos cuatro capas, y las cuatro cambian:
 *
 *   1. Los feriados de ley (LFT art. 74, LOPJF, CFF art. 12).
 *   2. Los dos periodos vacacionales de cada órgano — el del Poder Judicial de
 *      la Federación NO coincide con el del Tribunal Superior de Justicia de
 *      cada entidad, ni con el del TFJA, ni con el de los Tribunales Laborales.
 *   3. Los días que cada órgano declara inhábiles por acuerdo (suspensión de
 *      labores, contingencias, cambio de sistema, jornadas electorales).
 *   4. Los que un tribunal en particular suspende por causas propias.
 *
 * Hardcodear esto garantiza estar equivocado el año que viene. Por eso el
 * calendario es DATO editable por despacho y por órgano, versionado por año, y
 * el motor solo hace aritmética sobre él.
 *
 * ⚠️ Un calendario incompleto produce un vencimiento ADELANTADO respecto del
 * real (contamos como hábil un día que no lo era), nunca uno atrasado. El error
 * es conservador —se avisa antes de tiempo— pero sigue siendo un error, y por
 * eso el resultado del cómputo siempre viaja con la cobertura del calendario
 * usado. Ver `cobertura()`.
 */

import {
  comparar,
  dentroDeRango,
  esFinDeSemana,
  exigirFechaISO,
  sumarDias,
  type FechaISO,
} from './fecha'

export type MotivoInhabil =
  /** Sábado o domingo. */
  | 'fin_de_semana'
  /** Feriado de ley (LFT art. 74, LOPJF art. 163, CFF art. 12). */
  | 'feriado'
  /** Periodo vacacional del órgano jurisdiccional. */
  | 'vacaciones'
  /** Suspensión de labores por acuerdo del propio órgano. */
  | 'suspension'

export const MOTIVO_ETIQUETA: Record<MotivoInhabil, string> = {
  fin_de_semana: 'Fin de semana',
  feriado: 'Día feriado',
  vacaciones: 'Periodo vacacional del órgano',
  suspension: 'Suspensión de labores',
}

/**
 * Un tramo inhábil. Un solo día se expresa con `desde === hasta`; así los
 * periodos vacacionales y los feriados sueltos usan la misma estructura y no
 * hay dos caminos que mantener.
 */
export interface PeriodoInhabil {
  desde: FechaISO
  /** Inclusivo. */
  hasta: FechaISO
  motivo: Exclude<MotivoInhabil, 'fin_de_semana'>
  descripcion: string
  /** De dónde sale: el artículo, el acuerdo o la circular. */
  fundamento?: string
}

export interface Calendario {
  /** Identificador estable, p. ej. `pjf-2026` o `tsjcdmx-2026`. */
  id: string
  nombre: string
  /**
   * Rango que este calendario declara cubrir. Fuera de él, el cómputo no puede
   * prometer nada: puede haber inhábiles que no conocemos.
   */
  vigenciaDesde: FechaISO
  vigenciaHasta: FechaISO
  /**
   * Sábado y domingo inhábiles. Verdadero en todos los regímenes vigentes hoy,
   * pero es un parámetro y no una constante porque hay actuaciones y guardias
   * (amparo con acto de imposible reparación, penal) que sí corren en fin de
   * semana cuando el órgano habilita días y horas.
   */
  finDeSemanaInhabil: boolean
  periodos: readonly PeriodoInhabil[]
}

export interface ResultadoInhabil {
  inhabil: boolean
  motivo: MotivoInhabil | null
  descripcion: string | null
  fundamento?: string
}

const HABIL: ResultadoInhabil = {
  inhabil: false,
  motivo: null,
  descripcion: null,
}

/**
 * ¿Ese día es inhábil, y por qué?
 *
 * El motivo importa tanto como el sí/no: en el detalle del cómputo el abogado
 * necesita ver *por qué* se saltó un día para poder auditarlo.
 */
export function evaluarDia(
  fecha: FechaISO,
  calendario: Calendario,
): ResultadoInhabil {
  exigirFechaISO(fecha, 'fecha')

  if (calendario.finDeSemanaInhabil && esFinDeSemana(fecha)) {
    return {
      inhabil: true,
      motivo: 'fin_de_semana',
      descripcion: MOTIVO_ETIQUETA.fin_de_semana,
    }
  }

  for (const periodo of calendario.periodos) {
    if (dentroDeRango(fecha, periodo.desde, periodo.hasta)) {
      return {
        inhabil: true,
        motivo: periodo.motivo,
        descripcion: periodo.descripcion,
        fundamento: periodo.fundamento,
      }
    }
  }

  return HABIL
}

export function esHabil(fecha: FechaISO, calendario: Calendario): boolean {
  return !evaluarDia(fecha, calendario).inhabil
}

/**
 * Tope de días naturales que el motor recorre buscando hábiles antes de
 * rendirse. Un plazo real nunca se acerca: son casi tres años de calendario.
 * Existe para que un calendario mal capturado (todo el año inhábil) falle con
 * un error legible en vez de colgar el proceso.
 */
const TOPE_BUSQUEDA_DIAS = 1000

/** El primer día hábil en `fecha` o después. Si ya es hábil, la devuelve. */
export function habilEnOSiguiente(
  fecha: FechaISO,
  calendario: Calendario,
): FechaISO {
  let cursor = exigirFechaISO(fecha, 'fecha')
  for (let i = 0; i <= TOPE_BUSQUEDA_DIAS; i++) {
    if (esHabil(cursor, calendario)) return cursor
    cursor = sumarDias(cursor, 1)
  }
  throw new Error(
    `Calendario '${calendario.id}': no se halló un día hábil en ${TOPE_BUSQUEDA_DIAS} días desde ${fecha}. Revisa los periodos inhábiles capturados.`,
  )
}

/** El siguiente día hábil, estrictamente posterior a `fecha`. */
export function siguienteHabil(
  fecha: FechaISO,
  calendario: Calendario,
): FechaISO {
  return habilEnOSiguiente(sumarDias(fecha, 1), calendario)
}

export interface DiaContado {
  fecha: FechaISO
  /** 1..n — la posición del día dentro del plazo. */
  ordinal: number
}

export interface ConteoHabiles {
  /** Los días hábiles que integraron el plazo, en orden. */
  dias: readonly DiaContado[]
  /** El último día contado: el del vencimiento. */
  ultimoDia: FechaISO
  /** Días inhábiles que se saltaron, con su motivo, para el detalle. */
  omitidos: readonly { fecha: FechaISO; motivo: MotivoInhabil; descripcion: string }[]
}

/**
 * Cuenta `cantidad` días hábiles a partir de `primerDia` (inclusive si es
 * hábil; si no, arranca en el primer hábil posterior).
 *
 * El día del vencimiento SÍ se cuenta — es la regla expresa del Código de
 * Comercio art. 1075 y de la Ley de Amparo art. 22, y es donde más se equivoca
 * quien cuenta a mano: un plazo de 9 días que arranca el lunes vence el
 * jueves de la semana siguiente, no el viernes.
 */
export function contarDiasHabiles(
  primerDia: FechaISO,
  cantidad: number,
  calendario: Calendario,
): ConteoHabiles {
  exigirFechaISO(primerDia, 'primerDia')
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new RangeError(
      `La cantidad de días debe ser un entero de al menos 1 y llegó ${cantidad}`,
    )
  }

  const dias: DiaContado[] = []
  const omitidos: { fecha: FechaISO; motivo: MotivoInhabil; descripcion: string }[] = []

  let cursor = primerDia
  let recorridos = 0

  while (dias.length < cantidad) {
    if (recorridos++ > TOPE_BUSQUEDA_DIAS) {
      throw new Error(
        `Calendario '${calendario.id}': no se completaron ${cantidad} días hábiles desde ${primerDia}. Revisa los periodos inhábiles capturados.`,
      )
    }
    const evaluacion = evaluarDia(cursor, calendario)
    if (evaluacion.inhabil) {
      omitidos.push({
        fecha: cursor,
        motivo: evaluacion.motivo as MotivoInhabil,
        descripcion: evaluacion.descripcion ?? '',
      })
    } else {
      dias.push({ fecha: cursor, ordinal: dias.length + 1 })
    }
    cursor = sumarDias(cursor, 1)
  }

  const ultimo = dias[dias.length - 1]
  // `cantidad >= 1` garantiza que hay al menos un día; el guard es para el
  // compilador bajo noUncheckedIndexedAccess, no una posibilidad real.
  if (!ultimo) throw new Error('Conteo vacío: estado imposible')

  return { dias, ultimoDia: ultimo.fecha, omitidos }
}

/**
 * ¿El calendario cubre todo el tramo que el cómputo necesita recorrer?
 *
 * Si el plazo se sale de la vigencia capturada, el resultado sigue siendo
 * aritméticamente correcto pero deja de ser confiable: pudo haber vacaciones o
 * un acuerdo de suspensión que nadie cargó. El motor no oculta eso, lo reporta.
 */
export function cobertura(
  calendario: Calendario,
  desde: FechaISO,
  hasta: FechaISO,
): { completa: boolean; faltante: string | null } {
  if (comparar(desde, calendario.vigenciaDesde) < 0) {
    return {
      completa: false,
      faltante: `El calendario '${calendario.nombre}' inicia el ${calendario.vigenciaDesde} y el cómputo arranca antes, el ${desde}.`,
    }
  }
  if (comparar(hasta, calendario.vigenciaHasta) > 0) {
    return {
      completa: false,
      faltante: `El calendario '${calendario.nombre}' termina el ${calendario.vigenciaHasta} y el cómputo llega hasta el ${hasta}. Carga los días inhábiles del periodo siguiente antes de confiar en esta fecha.`,
    }
  }
  return { completa: true, faltante: null }
}

export interface DiaDelTramo {
  fecha: FechaISO
  habil: boolean
}

/**
 * Los días naturales entre dos fechas, cada uno marcado hábil o inhábil.
 *
 * Es lo que come la **cinta de días** de la interfaz. Existe porque el error
 * que hace perder términos no es no saber la fecha: es creer que "faltan nueve
 * días" significa nueve días de trabajo. Pintados uno por uno —siete vacíos y
 * dos sólidos— la trampa se ve sin leer nada.
 *
 * Devuelve vacío cuando `hasta` ya pasó: un plazo vencido no tiene cuenta
 * regresiva que enseñar, tiene otro mensaje.
 *
 * @param tope corte de seguridad. Con vacaciones judiciales de por medio un
 *   tramo puede pasar del mes, y una cinta de doscientas celdas no informa: se
 *   corta y la interfaz deja de marcar el vencimiento.
 */
export function tramoDeDias(
  desde: FechaISO,
  hasta: FechaISO,
  calendario: Calendario,
  tope = 45,
): DiaDelTramo[] {
  exigirFechaISO(desde, 'desde')
  exigirFechaISO(hasta, 'hasta')
  if (hasta < desde) return []

  const dias: DiaDelTramo[] = []
  let cursor = desde

  while (cursor <= hasta && dias.length < tope) {
    dias.push({ fecha: cursor, habil: !evaluarDia(cursor, calendario).inhabil })
    cursor = sumarDias(cursor, 1)
  }

  return dias
}

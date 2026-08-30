/**
 * Motor de cómputo de plazos procesales.
 *
 * Función pura: entra la notificación y el plazo, sale la fecha de vencimiento
 * CON su explicación paso a paso. Sin base de datos, sin reloj, sin efectos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL RESULTADO INCLUYE LA TRAZA Y NO SOLO LA FECHA
 * ─────────────────────────────────────────────────────────────────────────────
 * Un abogado no puede firmar una promoción confiando en una fecha que le
 * escupió una caja negra: si el cómputo está mal, el que responde ante el
 * cliente y ante la barra es él, no el software. Así que el motor entrega el
 * razonamiento completo —qué día surtió efectos, cuál fue el primer día, qué
 * días se saltaron y por qué, con qué fundamento— para que se pueda auditar en
 * treinta segundos y corregir a mano cuando haga falta.
 *
 * Ese es también el diseño defensivo correcto: la herramienta propone, el
 * abogado confirma, y queda registrado quién confirmó. Ver `confiabilidad`.
 */

import {
  cobertura,
  contarDiasHabiles,
  esHabil,
  evaluarDia,
  habilEnOSiguiente,
  siguienteHabil,
  type Calendario,
  type DiaContado,
  type MotivoInhabil,
} from './calendario'
import {
  exigirFechaISO,
  fechaLargaConDia,
  sumarDias,
  type FechaISO,
} from './fecha'
import {
  REGIMENES,
  reglaDeSurtimiento,
  UNIDAD_ETIQUETA,
  type EstadoVerificacion,
  type IdRegimen,
  type TipoNotificacion,
  type UnidadPlazo,
} from './regimenes'

export interface EntradaComputo {
  regimen: IdRegimen
  tipoNotificacion: TipoNotificacion
  /** Fecha en que se PRACTICÓ la notificación (la del acuse, no la del acuerdo). */
  fechaNotificacion: FechaISO
  /** Duración del plazo. Entero ≥ 1. */
  dias: number
  /** Por omisión, la unidad propia del régimen. */
  unidad?: UnidadPlazo
  calendario: Calendario
  /** Nombre del plazo, para el encabezado del detalle. */
  etiqueta?: string
  /** Fundamento del plazo en sí (distinto del fundamento del cómputo). */
  fundamentoPlazo?: string
  /** Estado de verificación del plazo del catálogo. */
  verificacionPlazo?: EstadoVerificacion
  /**
   * Ampliación por término de la distancia, en días de la misma unidad.
   * Se suma a la duración; el detalle lo deja explícito.
   */
  diasPorDistancia?: number
  /**
   * Si el vencimiento cae en día inhábil, recorrerlo al siguiente hábil.
   * Solo puede ocurrir con plazos en días naturales — contando hábiles el
   * último día es hábil por construcción.
   */
  recorrerVencimientoInhabil?: boolean
}

export interface PasoComputo {
  orden: number
  titulo: string
  detalle: string
  fecha?: FechaISO
  fundamento?: string
}

export interface DiaOmitido {
  fecha: FechaISO
  motivo: MotivoInhabil
  descripcion: string
}

export interface ResultadoComputo {
  /** Lo que entró, normalizado. */
  fechaNotificacion: FechaISO
  tipoNotificacion: TipoNotificacion
  regimen: IdRegimen
  unidad: UnidadPlazo
  /** Duración efectiva, ya sumada la ampliación por distancia. */
  diasDelPlazo: number

  /** El día en que la notificación surtió efectos. */
  fechaSurteEfectos: FechaISO
  /** El primer día que se cuenta dentro del plazo. */
  primerDia: FechaISO
  /** El último día para presentar. */
  fechaVencimiento: FechaISO

  /** Los días que integraron el plazo (solo en cómputo por hábiles). */
  diasContados: readonly DiaContado[]
  /** Los días que se saltaron, con su motivo. */
  diasOmitidos: readonly DiaOmitido[]

  /** La explicación auditable, en orden. */
  pasos: readonly PasoComputo[]
  advertencias: readonly string[]
  fundamentos: readonly string[]

  /**
   * `semilla_no_verificada` mientras el despacho no haya confirmado el régimen
   * Y el plazo. Basta que uno de los dos venga de fábrica para que todo el
   * cómputo quede marcado: la cadena vale lo que su eslabón más débil.
   */
  confiabilidad: EstadoVerificacion
  /** ¿El calendario cubría todo el tramo recorrido? */
  coberturaCompleta: boolean
}

/**
 * Calcula el vencimiento de un plazo procesal.
 *
 * @throws si la fecha no es válida o la duración no es un entero positivo.
 */
export function computarPlazo(entrada: EntradaComputo): ResultadoComputo {
  const {
    regimen: idRegimen,
    tipoNotificacion,
    calendario,
    etiqueta,
    fundamentoPlazo,
    diasPorDistancia = 0,
    recorrerVencimientoInhabil = true,
  } = entrada

  const fechaNotificacion = exigirFechaISO(
    entrada.fechaNotificacion,
    'fechaNotificacion',
  )
  const regimen = REGIMENES[idRegimen]
  if (!regimen) throw new RangeError(`Régimen desconocido: ${idRegimen}`)

  const unidad = entrada.unidad ?? regimen.unidadPorDefecto

  if (!Number.isInteger(entrada.dias) || entrada.dias < 1) {
    throw new RangeError(
      `La duración del plazo debe ser un entero de al menos 1 día y llegó ${entrada.dias}`,
    )
  }
  if (!Number.isInteger(diasPorDistancia) || diasPorDistancia < 0) {
    throw new RangeError(
      `El término de la distancia debe ser un entero de 0 o más y llegó ${diasPorDistancia}`,
    )
  }

  const diasDelPlazo = entrada.dias + diasPorDistancia

  const pasos: PasoComputo[] = []
  const advertencias: string[] = [...regimen.advertencias]
  const fundamentos: string[] = [regimen.fundamentoComputo]
  if (fundamentoPlazo) fundamentos.unshift(fundamentoPlazo)

  // ── Paso 1: la notificación ────────────────────────────────────────────────
  pasos.push({
    orden: 1,
    titulo: 'Notificación practicada',
    detalle: `${etiqueta ? `${etiqueta}. ` : ''}Notificación ${tipoNotificacion === 'lista' ? 'por lista, boletín o estrados' : tipoNotificacion} practicada el ${fechaLargaConDia(fechaNotificacion)}.`,
    fecha: fechaNotificacion,
  })

  // ── Paso 2: cuándo surte efectos ───────────────────────────────────────────
  const regla = reglaDeSurtimiento(idRegimen, tipoNotificacion)
  if (!regla) {
    throw new RangeError(
      `El régimen '${regimen.nombre}' no tiene regla capturada para notificación '${tipoNotificacion}'.`,
    )
  }
  if (regla.nota) advertencias.push(regla.nota)
  fundamentos.push(regla.fundamento)

  const fechaSurteEfectos =
    regla.cuando === 'mismo_dia'
      ? fechaNotificacion
      : // "Al día siguiente" se entiende al siguiente día hábil: en un día
        // inhábil el órgano no labora y la notificación no puede surtir.
        siguienteHabil(fechaNotificacion, calendario)

  pasos.push({
    orden: 2,
    titulo: 'Surte efectos',
    detalle:
      regla.cuando === 'mismo_dia'
        ? `La notificación surte efectos el mismo día en que se practica: ${fechaLargaConDia(fechaSurteEfectos)}.`
        : `La notificación surte efectos al día hábil siguiente: ${fechaLargaConDia(fechaSurteEfectos)}.`,
    fecha: fechaSurteEfectos,
    fundamento: regla.fundamento,
  })

  // ── Paso 3: el primer día del plazo ────────────────────────────────────────
  // Segundo salto: el plazo corre a partir del día siguiente al que surtió.
  const primerDia = siguienteHabil(fechaSurteEfectos, calendario)

  pasos.push({
    orden: 3,
    titulo: 'Primer día del plazo',
    detalle: `El plazo empieza a correr al día siguiente de que surtió efectos: ${fechaLargaConDia(primerDia)}.`,
    fecha: primerDia,
    fundamento: regimen.fundamentoComputo,
  })

  // ── Paso 4: el conteo ──────────────────────────────────────────────────────
  let fechaVencimiento: FechaISO
  let diasContados: readonly DiaContado[] = []
  let diasOmitidos: readonly DiaOmitido[] = []

  if (unidad === 'habiles') {
    const conteo = contarDiasHabiles(primerDia, diasDelPlazo, calendario)
    fechaVencimiento = conteo.ultimoDia
    diasContados = conteo.dias
    diasOmitidos = conteo.omitidos

    const resumenOmitidos =
      conteo.omitidos.length === 0
        ? 'No hubo días inhábiles de por medio.'
        : `Se saltaron ${conteo.omitidos.length} día(s) inhábil(es).`

    pasos.push({
      orden: 4,
      titulo: `Conteo de ${diasDelPlazo} ${UNIDAD_ETIQUETA.habiles}`,
      detalle: `${resumenOmitidos} El día del vencimiento se cuenta dentro del plazo.`,
      fecha: fechaVencimiento,
      fundamento: regimen.fundamentoComputo,
    })
  } else {
    // Naturales: corren corridos, inhábiles incluidos. El primer día cuenta,
    // así que el último es primerDia + (dias - 1).
    const ultimoNatural = sumarDias(primerDia, diasDelPlazo - 1)
    pasos.push({
      orden: 4,
      titulo: `Conteo de ${diasDelPlazo} ${UNIDAD_ETIQUETA.naturales}`,
      detalle: `Los días naturales corren corridos, incluidos sábados, domingos e inhábiles. Último día natural: ${fechaLargaConDia(ultimoNatural)}.`,
      fecha: ultimoNatural,
      fundamento: regimen.fundamentoComputo,
    })

    if (recorrerVencimientoInhabil && !esHabil(ultimoNatural, calendario)) {
      const evaluacion = evaluarDia(ultimoNatural, calendario)
      fechaVencimiento = habilEnOSiguiente(ultimoNatural, calendario)
      pasos.push({
        orden: 5,
        titulo: 'Recorrido por vencimiento inhábil',
        detalle: `El último día natural cae en ${evaluacion.descripcion?.toLowerCase() ?? 'día inhábil'}, cuando el órgano no recibe promociones, así que el vencimiento se recorre al siguiente día hábil: ${fechaLargaConDia(fechaVencimiento)}.`,
        fecha: fechaVencimiento,
      })
    } else {
      fechaVencimiento = ultimoNatural
    }
  }

  if (diasPorDistancia > 0) {
    advertencias.push(
      `Se sumaron ${diasPorDistancia} día(s) por término de la distancia. Confirma que la ampliación proceda y que el número sea el correcto para este órgano.`,
    )
  }

  // ── Cobertura y confiabilidad ──────────────────────────────────────────────
  const cob = cobertura(calendario, fechaNotificacion, fechaVencimiento)
  if (!cob.completa && cob.faltante) advertencias.push(cob.faltante)

  const verificacionPlazo = entrada.verificacionPlazo ?? 'semilla_no_verificada'
  const confiabilidad: EstadoVerificacion =
    regimen.verificacion === 'verificado_por_despacho' &&
    verificacionPlazo === 'verificado_por_despacho'
      ? 'verificado_por_despacho'
      : 'semilla_no_verificada'

  if (confiabilidad === 'semilla_no_verificada') {
    advertencias.push(
      'Cómputo apoyado en catálogo no verificado por el despacho. Confírmalo contra el texto vigente antes de agendar la presentación.',
    )
  }

  return {
    fechaNotificacion,
    tipoNotificacion,
    regimen: idRegimen,
    unidad,
    diasDelPlazo,
    fechaSurteEfectos,
    primerDia,
    fechaVencimiento,
    diasContados,
    diasOmitidos,
    pasos,
    advertencias: dedup(advertencias),
    fundamentos: dedup(fundamentos),
    confiabilidad,
    coberturaCompleta: cob.completa,
  }
}

/** Quita repetidos conservando el orden: las advertencias se juntan de varias fuentes. */
function dedup(valores: readonly string[]): string[] {
  return [...new Set(valores.filter((v) => v.trim().length > 0))]
}

/**
 * Resumen de una línea para listas y correos.
 * Deliberadamente NO afirma; describe un cómputo.
 */
export function resumenComputo(resultado: ResultadoComputo): string {
  return `Cómputo sugerido: vence el ${fechaLargaConDia(resultado.fechaVencimiento)} (${resultado.diasDelPlazo} ${UNIDAD_ETIQUETA[resultado.unidad]} desde el ${fechaLargaConDia(resultado.primerDia)}).`
}

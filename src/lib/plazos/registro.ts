/**
 * Captura del registro de una notificación (pura, sin efectos).
 *
 * Es la frontera entre lo que teclea el abogado y la entrada del motor de
 * cómputo. Aquí no se calcula nada: se valida y se arma.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS FORMAS DE INDICAR EL PLAZO, Y POR QUÉ HACEN FALTA LAS DOS
 * ─────────────────────────────────────────────────────────────────────────────
 * · Del catálogo: se elige "Contestación de demanda — ordinario mercantil" y
 *   los días y el fundamento vienen con él.
 * · A mano: días y etiqueta capturados.
 *
 * La segunda no es un atajo para gente floja: el catálogo nunca va a cubrir
 * todos los plazos de todas las vías de las 32 entidades, y un sistema que
 * solo acepte lo que trae de fábrica obliga a llevar el resto en un papel
 * aparte. En cuanto eso pasa, el sistema deja de ser la fuente y el aviso deja
 * de servir.
 *
 * Eso sí: un plazo capturado a mano no tiene fundamento verificado, y el
 * resultado sale marcado igual que el de fábrica.
 */

import { esFechaISO, type FechaISO } from './fecha'
import type { TipoNotificacion, UnidadPlazo } from './regimenes'
import { REGIMENES, reglaDeSurtimiento, type IdRegimen } from './regimenes'

export interface Problema {
  campo: string
  mensaje: string
}

export interface CapturaNotificacion {
  tipoNotificacion: TipoNotificacion
  fechaNotificacion: FechaISO | null
  /** Clave del catálogo, o `null` si el plazo se captura a mano. */
  plazoCatalogoClave: string | null
  /** Solo cuando es a mano. */
  etiquetaManual: string | null
  diasManual: number | null
  unidadManual: UnidadPlazo
  diasDistancia: number
  responsableId: string | null
  /** Qué dice el acuerdo notificado. Va a la bitácora. */
  detalle: string | null
}

const TIPOS: readonly TipoNotificacion[] = [
  'personal',
  'lista',
  'oficio',
  'electronica',
  'edictos',
]

function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

/** Entero no negativo, o `null`. */
export function leerEntero(valor: string | undefined): number | null {
  if (!valor) return null
  const limpio = valor.trim()
  if (!/^\d+$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isSafeInteger(n) ? n : null
}

export function leerNotificacion(
  campos: Record<string, string>,
): CapturaNotificacion {
  const tipo = campos.tipoNotificacion as TipoNotificacion

  return {
    tipoNotificacion: TIPOS.includes(tipo) ? tipo : 'personal',
    fechaNotificacion: esFechaISO(campos.fechaNotificacion?.trim())
      ? campos.fechaNotificacion.trim()
      : null,
    plazoCatalogoClave: texto(campos, 'plazoCatalogoClave'),
    etiquetaManual: texto(campos, 'etiquetaManual'),
    diasManual: leerEntero(campos.diasManual),
    unidadManual: campos.unidadManual === 'naturales' ? 'naturales' : 'habiles',
    diasDistancia: leerEntero(campos.diasDistancia) ?? 0,
    responsableId: texto(campos, 'responsableId'),
    detalle: texto(campos, 'detalle'),
  }
}

/**
 * Cuántos días naturales hacia atrás se acepta capturar una notificación.
 *
 * No se bloquea capturar el pasado —se registra el lunes lo que llegó el
 * viernes, y a veces se recupera un expediente atrasado—, pero más allá de
 * este margen casi siempre es un año mal tecleado. Y una fecha con el año
 * equivocado produce un plazo vencido hace meses que llena el panel de rojo
 * falso, o peor, uno que ya venció sin que nadie lo supiera.
 */
export const MARGEN_RETROACTIVO_DIAS = 365

export function validarNotificacion(
  captura: CapturaNotificacion,
  hoy: FechaISO,
): Problema[] {
  const problemas: Problema[] = []

  if (!captura.fechaNotificacion) {
    problemas.push({
      campo: 'fechaNotificacion',
      mensaje: 'Captura la fecha en que se practicó la notificación.',
    })
  } else {
    if (captura.fechaNotificacion > hoy) {
      problemas.push({
        campo: 'fechaNotificacion',
        mensaje: 'La notificación no puede ser de una fecha futura.',
      })
    }
    const dias = diasNaturalesEntre(captura.fechaNotificacion, hoy)
    if (dias > MARGEN_RETROACTIVO_DIAS) {
      problemas.push({
        campo: 'fechaNotificacion',
        mensaje: `Esa notificación tiene más de un año. Verifica el año antes de guardar.`,
      })
    }
  }

  const usaCatalogo = captura.plazoCatalogoClave !== null

  if (!usaCatalogo) {
    if (!captura.etiquetaManual) {
      problemas.push({
        campo: 'etiquetaManual',
        mensaje: 'Ponle nombre al plazo, o elige uno del catálogo.',
      })
    }
    if (captura.diasManual === null || captura.diasManual < 1) {
      problemas.push({
        campo: 'diasManual',
        mensaje: 'Captura de cuántos días es el plazo.',
      })
    }
  }

  if (captura.diasDistancia < 0) {
    problemas.push({
      campo: 'diasDistancia',
      mensaje: 'El término de la distancia no puede ser negativo.',
    })
  }

  return problemas
}

/** Días naturales entre dos fechas ISO. Sin husos: comparación de calendario. */
function diasNaturalesEntre(desde: FechaISO, hasta: FechaISO): number {
  const a = Date.UTC(
    Number(desde.slice(0, 4)),
    Number(desde.slice(5, 7)) - 1,
    Number(desde.slice(8, 10)),
  )
  const b = Date.UTC(
    Number(hasta.slice(0, 4)),
    Number(hasta.slice(5, 7)) - 1,
    Number(hasta.slice(8, 10)),
  )
  return Math.round((b - a) / 86_400_000)
}

/** El plazo resuelto: del catálogo o capturado a mano. */
export interface PlazoResuelto {
  etiqueta: string
  dias: number
  unidad: UnidadPlazo
  fundamento: string | null
  /** `null` cuando el plazo se capturó a mano. */
  catalogoId: string | null
}

export interface EntradaCatalogo {
  id: string
  clave: string | null
  etiqueta: string
  dias: number
  unidad: string
  fundamento: string
  verificado: boolean
}

/**
 * Decide con qué plazo se computa.
 *
 * @throws si se pidió una clave del catálogo que no existe. Es preferible
 *   fallar ruidosamente a computar con un plazo distinto del que el usuario
 *   creyó elegir.
 */
export function resolverPlazo(
  captura: CapturaNotificacion,
  catalogo: readonly EntradaCatalogo[],
): PlazoResuelto {
  if (captura.plazoCatalogoClave) {
    const entrada = catalogo.find((e) => e.clave === captura.plazoCatalogoClave)
    if (!entrada) {
      throw new RangeError(
        `El plazo "${captura.plazoCatalogoClave}" no está en el catálogo.`,
      )
    }
    return {
      etiqueta: entrada.etiqueta,
      dias: entrada.dias,
      unidad: entrada.unidad === 'naturales' ? 'naturales' : 'habiles',
      fundamento: entrada.fundamento,
      catalogoId: entrada.id,
    }
  }

  if (!captura.etiquetaManual || captura.diasManual === null) {
    throw new RangeError('Plazo manual incompleto: valida antes de resolver.')
  }

  return {
    etiqueta: captura.etiquetaManual,
    dias: captura.diasManual,
    unidad: captura.unidadManual,
    fundamento: null,
    catalogoId: null,
  }
}

/**
 * Advertencias propias del registro, que se suman a las del motor.
 *
 * Son las que dependen de CÓMO se capturó, no de la aritmética del plazo.
 */
export function advertenciasDelRegistro(
  captura: CapturaNotificacion,
  plazo: PlazoResuelto,
  regimen: IdRegimen,
): string[] {
  const advertencias: string[] = []

  if (plazo.catalogoId === null) {
    advertencias.push(
      'Plazo capturado a mano: no tiene fundamento registrado ni verificación. Anota el artículo aplicable en el detalle.',
    )
  }

  const regla = reglaDeSurtimiento(regimen, captura.tipoNotificacion)
  if (!regla) {
    advertencias.push(
      `El régimen ${REGIMENES[regimen].nombre} no tiene capturada una regla para notificación "${captura.tipoNotificacion}".`,
    )
  }

  return advertencias
}

/**
 * Estado del registro de notificación, fuera del archivo `'use server'`.
 */

/** Un paso de la traza, aplanado para cruzar al cliente. */
export interface PasoVisible {
  orden: number
  titulo: string
  detalle: string
  fecha: string | null
  fundamento: string | null
}

/**
 * El cómputo propuesto, con todo lo necesario para auditarlo en pantalla.
 *
 * Se muestra ANTES de guardar. El producto entero se apoya en esto: un abogado
 * no puede firmar una promoción confiando en una fecha que le escupió una caja
 * negra, porque quien responde ante el cliente y ante la barra es él.
 */
export interface VistaPrevia {
  etiqueta: string
  fechaNotificacion: string
  fechaSurteEfectos: string
  primerDia: string
  fechaVencimiento: string
  diasDelPlazo: number
  unidad: string
  pasos: PasoVisible[]
  diasOmitidos: { fecha: string; descripcion: string }[]
  advertencias: string[]
  fundamentos: string[]
  confiabilidad: 'semilla_no_verificada' | 'verificado_por_despacho'
  coberturaCompleta: boolean
  calendarioNombre: string
  /** El calendario salió del régimen, no del órgano del expediente. */
  calendarioPorOmision: boolean
}

export interface EstadoNotificacion {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /** Mientras no sea `null`, se está mostrando el cómputo y NADA se ha guardado. */
  vista: VistaPrevia | null
}

export const ESTADO_INICIAL: EstadoNotificacion = {
  valores: {},
  error: null,
  problemas: {},
  vista: null,
}

export function conProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
): EstadoNotificacion {
  return { valores, error: null, problemas, vista: null }
}

export function conError(
  valores: Record<string, string>,
  error: string,
): EstadoNotificacion {
  return { valores, error, problemas: {}, vista: null }
}

export function conVista(
  valores: Record<string, string>,
  vista: VistaPrevia,
): EstadoNotificacion {
  return { valores, error: null, problemas: {}, vista }
}

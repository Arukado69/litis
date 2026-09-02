/**
 * Estado de la pantalla de suscripción, fuera del archivo `'use server'`.
 */

export interface EstadoContratar {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /**
   * Qué pasó cuando no hubo redirección a Stripe.
   *
   * En modo simulación —sin llaves— este es el único resultado posible: se dice
   * qué se habría cobrado y se deja claro que **el plan no cambió**.
   */
  aviso: string | null
}

export const ESTADO_INICIAL_CONTRATAR: EstadoContratar = {
  valores: {},
  error: null,
  problemas: {},
  aviso: null,
}

export function contratarConProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
): EstadoContratar {
  return { valores, error: null, problemas, aviso: null }
}

export function contratarConError(
  valores: Record<string, string>,
  error: string,
): EstadoContratar {
  return { valores, error, problemas: {}, aviso: null }
}

export function contratarConAviso(aviso: string): EstadoContratar {
  return { valores: {}, error: null, problemas: {}, aviso }
}

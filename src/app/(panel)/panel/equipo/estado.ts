/**
 * Estado de las pantallas de equipo, fuera de los archivos `'use server'`.
 */

export interface EstadoInvitar {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /**
   * El enlace recién creado, en claro.
   *
   * Se devuelve UNA vez y solo aquí: a la base va nada más el hash, así que
   * este es el único momento en que existe. Se enseña en pantalla a propósito
   * —para copiarlo por WhatsApp, que es como se coordina de verdad un despacho
   * chico— y porque sin proveedor de correo configurado es la única vía.
   */
  enlace: string | null
  /** Qué pasó con el correo: enviado, simulado o falló. */
  aviso: string | null
}

export const ESTADO_INICIAL_INVITAR: EstadoInvitar = {
  valores: {},
  error: null,
  problemas: {},
  enlace: null,
  aviso: null,
}

export function invitarConProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
): EstadoInvitar {
  return { valores, error: null, problemas, enlace: null, aviso: null }
}

export function invitarConError(
  valores: Record<string, string>,
  error: string,
): EstadoInvitar {
  return { valores, error, problemas: {}, enlace: null, aviso: null }
}

// ── Aceptación, en la pantalla pública ──────────────────────────────────────

export interface EstadoAceptar {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
}

export const ESTADO_INICIAL_ACEPTAR: EstadoAceptar = {
  valores: {},
  error: null,
  problemas: {},
}

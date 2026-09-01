/** Estado del alta de acceso del cliente, fuera del archivo `'use server'`. */

export interface EstadoInvitar {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /** El enlace en claro. Existe una sola vez: a la base va solo su hash. */
  enlace: string | null
  aviso: string | null
}

export const ESTADO_INICIAL_ACCESO: EstadoInvitar = {
  valores: {},
  error: null,
  problemas: {},
  enlace: null,
  aviso: null,
}

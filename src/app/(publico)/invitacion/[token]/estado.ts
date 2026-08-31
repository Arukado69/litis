/** Estado de la pantalla de aceptación, fuera del archivo `'use server'`. */

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

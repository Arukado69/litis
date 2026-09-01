/** Estado del alta de audiencia, fuera del archivo `'use server'`. */

export interface EstadoAudiencia {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /** Lo que falta pero no impide guardar. */
  advertencias: string[]
  guardado: string | null
}

export const ESTADO_INICIAL_AUDIENCIA: EstadoAudiencia = {
  valores: {},
  error: null,
  problemas: {},
  advertencias: [],
  guardado: null,
}

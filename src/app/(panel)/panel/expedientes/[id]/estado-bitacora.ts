/**
 * Estado de la bitácora y los documentos, fuera de los archivos `'use server'`.
 */

export interface EstadoActuacion {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  guardado: string | null
}

export const ESTADO_INICIAL_ACTUACION: EstadoActuacion = {
  valores: {},
  error: null,
  problemas: {},
  guardado: null,
}

export interface EstadoDocumento {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  guardado: string | null
}

export const ESTADO_INICIAL_DOCUMENTO: EstadoDocumento = {
  valores: {},
  error: null,
  problemas: {},
  guardado: null,
}

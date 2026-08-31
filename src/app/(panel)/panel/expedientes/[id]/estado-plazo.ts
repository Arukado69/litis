/**
 * Estado del cierre de un plazo, fuera del archivo `'use server'`.
 *
 * Un archivo `'use server'` solo puede exportar funciones asíncronas: cualquier
 * constante o tipo que exporte rompe la compilación. Por eso el estado vive
 * aquí y la acción al lado.
 */

export interface EstadoCierre {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /**
   * El aviso de extemporaneidad. Aparece cuando la fecha capturada cae después
   * del vencimiento, ANTES de guardar nada.
   */
  aviso: string | null
}

export const ESTADO_INICIAL_CIERRE: EstadoCierre = {
  valores: {},
  error: null,
  problemas: {},
  aviso: null,
}

export function cierreConProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
  aviso: string | null = null,
): EstadoCierre {
  return { valores, error: null, problemas, aviso }
}

export function cierreConError(
  valores: Record<string, string>,
  error: string,
): EstadoCierre {
  return { valores, error, problemas: {}, aviso: null }
}

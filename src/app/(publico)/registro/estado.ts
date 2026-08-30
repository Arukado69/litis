/**
 * Estado y tipos del formulario, fuera del archivo `'use server'`.
 *
 * Un módulo con `'use server'` SOLO puede exportar funciones async: cada
 * export se convierte en un punto de entrada invocable desde el navegador, y
 * por eso Next rechaza el resto. Exportar aquí la constante mantiene el
 * archivo de acciones limpio y el build en pie.
 */

export interface EstadoRegistro {
  error: string | null
  /** Por campo, para pintarlos junto al input. */
  problemas: Record<string, string>
  /** Se registró pero falta confirmar el correo. */
  confirmaCorreo: boolean
}

export const ESTADO_INICIAL: EstadoRegistro = {
  error: null,
  problemas: {},
  confirmaCorreo: false,
}

export function conProblemas(problemas: Record<string, string>): EstadoRegistro {
  return { error: null, problemas, confirmaCorreo: false }
}

export function conError(error: string): EstadoRegistro {
  return { error, problemas: {}, confirmaCorreo: false }
}

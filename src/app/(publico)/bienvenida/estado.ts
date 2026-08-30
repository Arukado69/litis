/**
 * Estado y tipos del formulario, fuera del archivo `'use server'`.
 *
 * Un módulo con `'use server'` SOLO puede exportar funciones async: cada
 * export se convierte en un punto de entrada invocable desde el navegador, y
 * por eso Next rechaza el resto. Exportar aquí la constante mantiene el
 * archivo de acciones limpio y el build en pie.
 */

export interface EstadoBienvenida {
  error: string | null
}

export const ESTADO_INICIAL: EstadoBienvenida = { error: null }

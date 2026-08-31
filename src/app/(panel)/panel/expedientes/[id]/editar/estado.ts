/**
 * Estado del editor de expediente, fuera del archivo `'use server'`.
 * Ahí solo caben funciones async.
 */

import type { HallazgoVisible } from '../../nuevo/estado'

export interface EstadoEdicion {
  /**
   * Lo tecleado, de regreso. React 19 resetea un formulario no controlado
   * después de una Server Action; sin esto, un error de validación vacía la
   * pantalla y hay que capturar todo otra vez.
   */
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /** Qué se guardó, para decirlo en vez de dejar la pantalla igual. */
  guardado: string | null
}

export const ESTADO_INICIAL_EDICION: EstadoEdicion = {
  valores: {},
  error: null,
  problemas: {},
  guardado: null,
}

export function edicionConProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
): EstadoEdicion {
  return { valores, error: null, problemas, guardado: null }
}

export function edicionConError(
  valores: Record<string, string>,
  error: string,
): EstadoEdicion {
  return { valores, error, problemas: {}, guardado: null }
}

export function edicionGuardada(guardado: string): EstadoEdicion {
  return { valores: {}, error: null, problemas: {}, guardado }
}

// ── Alta de una parte sobre un expediente ya abierto ────────────────────────

export interface EstadoParte {
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  /**
   * Coincidencias en el padrón pendientes de que alguien las revise. Mientras
   * no sea `null`, la parte NO se ha agregado.
   */
  conflictos: HallazgoVisible[] | null
  guardado: string | null
}

export const ESTADO_INICIAL_PARTE: EstadoParte = {
  valores: {},
  error: null,
  problemas: {},
  conflictos: null,
  guardado: null,
}

export function parteConProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
): EstadoParte {
  return { valores, error: null, problemas, conflictos: null, guardado: null }
}

export function parteConError(
  valores: Record<string, string>,
  error: string,
): EstadoParte {
  return { valores, error, problemas: {}, conflictos: null, guardado: null }
}

export function parteConConflictos(
  valores: Record<string, string>,
  conflictos: HallazgoVisible[],
): EstadoParte {
  return { valores, error: null, problemas: {}, conflictos, guardado: null }
}

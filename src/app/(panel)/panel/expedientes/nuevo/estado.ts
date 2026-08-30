/**
 * Estado del formulario de alta, fuera del archivo `'use server'`.
 * Ver la nota en las demás pantallas: ahí solo caben funciones async.
 */

import type {
  NivelConflicto,
  TipoCoincidencia,
} from '@/lib/conflictos/deteccion'

/** Un hallazgo aplanado para cruzar la frontera cliente/servidor. */
export interface HallazgoVisible {
  nivel: NivelConflicto
  coincidencia: TipoCoincidencia
  nombreParte: string
  nombreRegistro: string
  caratula: string
  motivo: string
}

export interface EstadoAlta {
  /**
   * Lo que se tecleó, de regreso.
   *
   * React 19 RESETEA un formulario no controlado después de una Server
   * Action. Sin esto, al aparecer el aviso de conflicto la pantalla se
   * vaciaría y habría que capturar todo otra vez — con la tentación obvia de
   * ignorar el aviso la segunda vez. Como el reset devuelve cada campo a su
   * `defaultValue`, basta con que ese default sea lo ya capturado.
   */
  valores: Record<string, string>
  error: string | null
  /** Por campo, para pintarlos junto al input. */
  problemas: Record<string, string>
  /**
   * Hallazgos de conflicto de interés pendientes de que alguien los revise.
   * Mientras esto no sea `null`, el alta NO se ha guardado.
   */
  conflictos: HallazgoVisible[] | null
}

export const ESTADO_INICIAL: EstadoAlta = {
  valores: {},
  error: null,
  problemas: {},
  conflictos: null,
}

export function conProblemas(
  valores: Record<string, string>,
  problemas: Record<string, string>,
): EstadoAlta {
  return { valores, error: null, problemas, conflictos: null }
}

export function conError(
  valores: Record<string, string>,
  error: string,
): EstadoAlta {
  return { valores, error, problemas: {}, conflictos: null }
}

export function conConflictos(
  valores: Record<string, string>,
  conflictos: HallazgoVisible[],
): EstadoAlta {
  return { valores, error: null, problemas: {}, conflictos }
}

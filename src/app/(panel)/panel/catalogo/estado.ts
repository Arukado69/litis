/** Estado de la verificación, fuera del archivo `'use server'`. */

export interface EstadoVerificacion {
  /** Qué entrada respondió, para pintar el resultado en su renglón. */
  entradaId: string | null
  valores: Record<string, string>
  error: string | null
  problemas: Record<string, string>
  guardado: string | null
  /**
   * La corrección cambió los números y hay plazos vivos computados con los
   * viejos. NO se recalculan solos: aquí van para que alguien los revise.
   */
  aviso: string | null
  afectados: { id: string; expedienteId: string; etiqueta: string; caratula: string }[]
}

export const ESTADO_INICIAL_VERIFICACION: EstadoVerificacion = {
  entradaId: null,
  valores: {},
  error: null,
  problemas: {},
  guardado: null,
  aviso: null,
  afectados: [],
}

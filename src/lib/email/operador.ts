import 'server-only'

import { enviarConPlantilla } from './envio'

/**
 * Avisa al operador de que algo se rompió en un camino que corre sin nadie
 * mirando: la corrida de alertas, el webhook del cobro.
 *
 * ⚠️ **Nunca lanza.** Se llama justo cuando el camino principal ya falló, y una
 * excepción aquí escondería el fallo original detrás de otro.
 *
 * Escribe en consola SIEMPRE, mande correo o no: sin `CORREO_ALERTAS` la
 * consola del servidor es el único registro que queda.
 */
export async function avisarAlOperador(
  origen: string,
  titulo: string,
  detalle: string,
): Promise<void> {
  const destino = process.env.CORREO_ALERTAS?.trim()
  console.error(`[${origen}] ${titulo} — ${detalle}`)
  if (!destino) return

  try {
    await enviarConPlantilla(destino, {
      titulo,
      parrafos: [detalle],
      pie: `Aviso automático de Litis (${origen}).`,
    })
  } catch {
    // Ya se escribió en consola. Nada más que hacer.
  }
}

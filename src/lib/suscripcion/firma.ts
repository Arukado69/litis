import { createHmac } from 'node:crypto'

import { mismoSecreto } from '@/lib/seguridad/comparar'

/**
 * Verificación de la firma de un webhook de Stripe, a mano.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SIN LA LIBRERÍA DE STRIPE
 * ─────────────────────────────────────────────────────────────────────────────
 * Todo lo que este proyecto necesita de Stripe son tres llamadas HTTP y esta
 * verificación. El SDK oficial trae un cliente entero, sus tipos y su cadencia
 * de versiones para eso. La regla de la casa es que cada dependencia es deuda
 * de mantenimiento de un dev solo, y aquí el ahorro es un `createHmac` de
 * quince renglones — con la ventaja de que la regla queda escrita, legible y
 * probada, en vez de delegada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ IMPIDE, EXACTAMENTE
 * ─────────────────────────────────────────────────────────────────────────────
 * Sin esto, cualquiera que descubra la URL del webhook manda un JSON diciendo
 * "la suscripción del despacho X está activa con cincuenta asientos" y se
 * regala el producto. Con esto, el cuerpo tiene que venir firmado con el
 * secreto del endpoint.
 *
 * Y la ventana de tiempo importa tanto como la firma: un evento legítimo
 * capturado hoy se podría reenviar el mes que viene —con su firma buena— para
 * revivir una suscripción cancelada. Por eso se rechaza lo viejo.
 */

/** Cinco minutos, la tolerancia que recomienda Stripe. */
export const TOLERANCIA_SEGUNDOS = 300

export type ResultadoFirma = { ok: true } | { ok: false; motivo: string }

interface Encabezado {
  marca: number | null
  firmas: string[]
}

/** `t=1492774577,v1=5257a8…,v0=6ffbb5…` */
function leerEncabezado(encabezado: string): Encabezado {
  let marca: number | null = null
  const firmas: string[] = []

  for (const parte of encabezado.split(',')) {
    const [clave, valor] = parte.split('=', 2)
    if (!clave || !valor) continue
    const c = clave.trim()
    if (c === 't') {
      const n = Number.parseInt(valor.trim(), 10)
      marca = Number.isFinite(n) ? n : null
    } else if (c === 'v1') {
      // Solo `v1`. El `v0` de prueba se ignora a propósito: aceptar cualquier
      // esquema es exactamente el ataque de degradación que Stripe advierte.
      firmas.push(valor.trim())
    }
  }

  return { marca, firmas }
}

export function verificarFirmaStripe({
  cuerpo,
  encabezado,
  secreto,
  ahora,
  toleranciaSegundos = TOLERANCIA_SEGUNDOS,
}: {
  /** El cuerpo **crudo**, tal como llegó. Reserializar el JSON rompe la firma. */
  cuerpo: string
  encabezado: string | null
  secreto: string
  /** Milisegundos. Se recibe para poder probar la ventana. */
  ahora: number
  toleranciaSegundos?: number
}): ResultadoFirma {
  if (!secreto) return { ok: false, motivo: 'No hay secreto de webhook configurado.' }
  if (!encabezado) return { ok: false, motivo: 'Sin encabezado Stripe-Signature.' }

  const { marca, firmas } = leerEncabezado(encabezado)
  if (marca === null) return { ok: false, motivo: 'El encabezado no trae marca de tiempo.' }
  if (firmas.length === 0) return { ok: false, motivo: 'El encabezado no trae firma v1.' }

  const diferencia = Math.abs(Math.floor(ahora / 1000) - marca)
  if (diferencia > toleranciaSegundos) {
    return {
      ok: false,
      motivo: `El evento trae ${diferencia} segundos de antigüedad; el tope es ${toleranciaSegundos}.`,
    }
  }

  const esperada = createHmac('sha256', secreto)
    .update(`${marca}.${cuerpo}`, 'utf8')
    .digest('hex')

  // Puede haber más de una firma mientras se rota el secreto del endpoint. La
  // comparación es en tiempo constante, como todo secreto en este proyecto.
  const coincide = firmas.some((f) => mismoSecreto(f, esperada))

  return coincide ? { ok: true } : { ok: false, motivo: 'La firma no coincide.' }
}

/** Para las pruebas y para firmar en desarrollo. */
export function firmarComoStripe(
  cuerpo: string,
  secreto: string,
  marcaSegundos: number,
): string {
  const firma = createHmac('sha256', secreto)
    .update(`${marcaSegundos}.${cuerpo}`, 'utf8')
    .digest('hex')
  return `t=${marcaSegundos},v1=${firma}`
}

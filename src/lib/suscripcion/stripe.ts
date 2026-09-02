import 'server-only'

import { ASIENTOS_MAXIMOS } from './limites'

/**
 * Las tres llamadas que este proyecto le hace a Stripe, por HTTP directo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DEGRADA A SIMULACIÓN, PERO **NO REGALA EL PLAN**
 * ─────────────────────────────────────────────────────────────────────────────
 * Sin llaves, el módulo contesta `simulado`: la pantalla se puede recorrer
 * entera, se ve el precio y se ve qué se cobraría, y **el plan no cambia**.
 *
 * Esa última parte es deliberada y va contra la tentación de "para poder
 * probar, que la simulación active el plan". Si la simulación activara, un
 * despliegue con la variable mal escrita —una llave vacía, un secreto que no se
 * copió— dejaría a todo el mundo con el plan de paga sin haber cobrado, y nadie
 * se enteraría hasta ver la cuenta de Stripe vacía a fin de mes. Falla visible
 * y sin cobrar es mejor que falla silenciosa y regalada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIN EL SDK
 * ─────────────────────────────────────────────────────────────────────────────
 * Son dos POST con cuerpo `application/x-www-form-urlencoded` y una
 * verificación de firma (en `firma.ts`). El SDK oficial trae un cliente entero
 * y su cadencia de versiones para eso; cada dependencia es deuda de
 * mantenimiento de un dev solo.
 *
 * ⚠️ No se fija `Stripe-Version`: se usa la versión de API de la cuenta. Por eso
 * `eventos.ts` lee `current_period_end` en los dos lugares donde puede venir.
 */

const API = 'https://api.stripe.com/v1'

export interface ConfiguracionStripe {
  llave: string
  /** El id del precio por asiento al mes (`price_...`). */
  precio: string
}

export function configuracionStripe(): ConfiguracionStripe | null {
  const llave = process.env.STRIPE_SECRET_KEY?.trim()
  const precio = process.env.STRIPE_PRECIO_DESPACHO?.trim()
  if (!llave || !precio) return null
  return { llave, precio }
}

export function hayStripe(): boolean {
  return configuracionStripe() !== null
}

export type ResultadoCobro =
  /** Hay que mandar al navegador a esta URL de Stripe. */
  | { estado: 'listo'; url: string }
  /** No hay llaves: no se cobró nada y no cambió nada. */
  | { estado: 'simulado' }
  | { estado: 'falló'; motivo: string }

/** `{a: {b: 1}}` → `a[b]=1`, que es como Stripe recibe los parámetros. */
function aplanar(
  valor: unknown,
  prefijo: string,
  destino: URLSearchParams,
): void {
  if (valor === null || valor === undefined) return

  if (Array.isArray(valor)) {
    valor.forEach((v, i) => aplanar(v, `${prefijo}[${i}]`, destino))
    return
  }

  if (typeof valor === 'object') {
    for (const [clave, v] of Object.entries(valor as Record<string, unknown>)) {
      aplanar(v, `${prefijo}[${clave}]`, destino)
    }
    return
  }

  destino.set(prefijo, String(valor))
}

function comoFormulario(params: Record<string, unknown>): URLSearchParams {
  const cuerpo = new URLSearchParams()
  for (const [clave, valor] of Object.entries(params)) {
    aplanar(valor, clave, cuerpo)
  }
  return cuerpo
}

async function postear(
  ruta: string,
  params: Record<string, unknown>,
  llave: string,
): Promise<{ ok: true; datos: Record<string, unknown> } | { ok: false; motivo: string }> {
  try {
    const respuesta = await fetch(`${API}${ruta}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llave}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: comoFormulario(params).toString(),
    })

    const datos = (await respuesta.json()) as Record<string, unknown>

    if (!respuesta.ok) {
      const error = datos.error as { message?: string } | undefined
      return {
        ok: false,
        motivo: error?.message ?? `Stripe contestó ${respuesta.status}.`,
      }
    }

    return { ok: true, datos }
  } catch (error) {
    return {
      ok: false,
      motivo: error instanceof Error ? error.message : 'Error de red con Stripe.',
    }
  }
}

/**
 * Abre el cobro por asiento al mes.
 *
 * El despacho viaja en `client_reference_id` **y** en los metadatos de la
 * suscripción: el primero llega en `checkout.session.completed` y el segundo en
 * todos los `customer.subscription.*` posteriores, que son los que de verdad
 * mueven el plan. Sin el segundo, un cambio de cantidad hecho desde el portal
 * de Stripe llegaría sin saber de quién es.
 */
export async function crearSesionDeCheckout({
  despachoId,
  correo,
  clienteId,
  asientos,
  origen,
}: {
  despachoId: string
  correo: string
  /** Si el despacho ya es cliente de Stripe, se reusa: evita duplicarlo. */
  clienteId: string | null
  asientos: number
  origen: string
}): Promise<ResultadoCobro> {
  const config = configuracionStripe()
  if (!config) return { estado: 'simulado' }

  const params: Record<string, unknown> = {
    mode: 'subscription',
    line_items: [
      {
        price: config.precio,
        quantity: asientos,
        // Que el titular pueda mover la cantidad en la misma pantalla de pago.
        adjustable_quantity: { enabled: true, minimum: 1, maximum: ASIENTOS_MAXIMOS },
      },
    ],
    client_reference_id: despachoId,
    metadata: { despacho_id: despachoId },
    subscription_data: { metadata: { despacho_id: despachoId } },
    success_url: `${origen}/panel/suscripcion?cobro=listo`,
    cancel_url: `${origen}/panel/suscripcion?cobro=cancelado`,
    allow_promotion_codes: true,
    locale: 'es-419',
  }

  if (clienteId) params.customer = clienteId
  else params.customer_email = correo

  const r = await postear('/checkout/sessions', params, config.llave)
  if (!r.ok) return { estado: 'falló', motivo: r.motivo }

  const url = r.datos.url
  if (typeof url !== 'string') {
    return { estado: 'falló', motivo: 'Stripe no devolvió a dónde mandar al cliente.' }
  }
  return { estado: 'listo', url }
}

/**
 * El portal de facturación de Stripe: cambiar tarjeta, ver recibos, subir o
 * bajar asientos y cancelar.
 *
 * Se usa el de Stripe en vez de construir esas pantallas: son las que más
 * requisitos legales tienen (recibos, impuestos, cancelación) y las que menos
 * tienen que ver con llevar un expediente.
 */
export async function crearSesionDePortal({
  clienteId,
  origen,
}: {
  clienteId: string
  origen: string
}): Promise<ResultadoCobro> {
  const config = configuracionStripe()
  if (!config) return { estado: 'simulado' }

  const r = await postear(
    '/billing_portal/sessions',
    { customer: clienteId, return_url: `${origen}/panel/suscripcion`, locale: 'es-419' },
    config.llave,
  )
  if (!r.ok) return { estado: 'falló', motivo: r.motivo }

  const url = r.datos.url
  if (typeof url !== 'string') {
    return { estado: 'falló', motivo: 'Stripe no devolvió la URL del portal.' }
  }
  return { estado: 'listo', url }
}

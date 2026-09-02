import { cambioDesdeStripe, type CambioDeSuscripcion } from './limites'

/**
 * Qué hacer con un evento de Stripe, decidido sin tocar la base.
 *
 * Toda la lectura del JSON de Stripe vive aquí, aparte del route handler, por
 * dos razones: se puede probar sin base ni red, y las trampas del formato
 * —que son varias— quedan documentadas en un solo lugar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO SE ESCUCHAN CUATRO EVENTOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   checkout.session.completed      → enlaza el despacho con su cliente Stripe
 *   customer.subscription.created   ┐
 *   customer.subscription.updated   ├→ escriben plan, asientos y estado
 *   customer.subscription.deleted   ┘
 *
 * Los de factura (`invoice.payment_failed`, `invoice.paid`) no se escuchan: un
 * cobro fallido ya llega como `subscription.updated` con `status: past_due`, y
 * dos caminos que escriben el mismo estado terminan discrepando. Escuchar de
 * más también es lo que Stripe recomienda evitar.
 */

export type Instruccion =
  | { tipo: 'ignorar'; motivo: string }
  /** El titular acaba de pagar: hay que guardar a qué cliente de Stripe pertenece. */
  | {
      tipo: 'enlazar'
      despachoId: string
      clienteId: string
      suscripcionId: string | null
    }
  /** Cambió la suscripción: plan, asientos, estado y vigencia. */
  | {
      tipo: 'aplicar'
      /** Puede venir null: entonces el despacho se busca por `clienteId`. */
      despachoId: string | null
      clienteId: string | null
      suscripcionId: string
      cambio: CambioDeSuscripcion
      periodoFin: string | null
      cancelaAlFin: boolean
    }

// ── Lectura defensiva del JSON ──────────────────────────────────────────────
// Llega de la red. Aunque venga firmado, se lee como `unknown`: una firma
// válida garantiza el origen, no la forma.

type Objeto = Record<string, unknown>

function comoObjeto(v: unknown): Objeto | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
    ? (v as Objeto)
    : null
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

/** Stripe manda las referencias como id suelto o como objeto expandido. */
function idDe(v: unknown): string | null {
  if (typeof v === 'string') return v.length > 0 ? v : null
  const o = comoObjeto(v)
  return o ? texto(o.id) : null
}

function fechaUnix(v: unknown): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return null
  return new Date(v * 1000).toISOString()
}

function despachoDeMetadatos(o: Objeto | null): string | null {
  const meta = comoObjeto(o?.metadata)
  return meta ? texto(meta.despacho_id) : null
}

/**
 * La cantidad de asientos y hasta cuándo está pagado el periodo.
 *
 * ⚠️ `current_period_end` **se movió**: en las versiones recientes de la API de
 * Stripe vive en el renglón de la suscripción (`items.data[0]`), no en la
 * suscripción. Se leen los dos lugares porque el formato depende de la versión
 * de API de la cuenta, que no controlamos desde aquí.
 */
function renglon(suscripcion: Objeto): {
  cantidad: number
  periodoFin: string | null
} {
  const items = comoObjeto(suscripcion.items)
  const datos = Array.isArray(items?.data) ? items.data : []
  const primero = comoObjeto(datos[0])

  const cantidad =
    typeof primero?.quantity === 'number' && primero.quantity > 0
      ? primero.quantity
      : 1

  const periodoFin =
    fechaUnix(suscripcion.current_period_end) ??
    fechaUnix(primero?.current_period_end)

  return { cantidad, periodoFin }
}

export function interpretarEvento(evento: unknown): Instruccion {
  const raiz = comoObjeto(evento)
  const tipo = texto(raiz?.type)
  const objeto = comoObjeto(comoObjeto(raiz?.data)?.object)

  if (!tipo || !objeto) {
    return { tipo: 'ignorar', motivo: 'El evento no trae tipo ni objeto.' }
  }

  if (tipo === 'checkout.session.completed') {
    // Solo las sesiones de suscripción. Si algún día hay un pago suelto, no
    // tiene por qué mover el plan de nadie.
    if (texto(objeto.mode) !== 'subscription') {
      return { tipo: 'ignorar', motivo: 'Sesión de pago que no es suscripción.' }
    }

    const despachoId =
      texto(objeto.client_reference_id) ?? despachoDeMetadatos(objeto)
    const clienteId = idDe(objeto.customer)

    if (!despachoId || !clienteId) {
      return {
        tipo: 'ignorar',
        motivo: 'La sesión no dice de qué despacho ni de qué cliente es.',
      }
    }

    return {
      tipo: 'enlazar',
      despachoId,
      clienteId,
      suscripcionId: idDe(objeto.subscription),
    }
  }

  if (
    tipo === 'customer.subscription.created' ||
    tipo === 'customer.subscription.updated' ||
    tipo === 'customer.subscription.deleted'
  ) {
    const suscripcionId = texto(objeto.id)
    if (!suscripcionId) {
      return { tipo: 'ignorar', motivo: 'La suscripción no trae id.' }
    }

    // Un `deleted` a veces llega con el `status` que tenía antes de borrarse.
    // El tipo del evento manda: si Stripe la borró, está cancelada.
    const estado =
      tipo === 'customer.subscription.deleted'
        ? 'canceled'
        : (texto(objeto.status) ?? 'incomplete')

    const { cantidad, periodoFin } = renglon(objeto)

    return {
      tipo: 'aplicar',
      despachoId: despachoDeMetadatos(objeto),
      clienteId: idDe(objeto.customer),
      suscripcionId,
      cambio: cambioDesdeStripe(estado, cantidad),
      periodoFin,
      cancelaAlFin: objeto.cancel_at_period_end === true,
    }
  }

  return { tipo: 'ignorar', motivo: `No se escucha ${tipo}.` }
}

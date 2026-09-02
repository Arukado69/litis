import 'server-only'

import { avisarAlOperador } from '@/lib/email/operador'
import { clienteServicio } from '@/lib/supabase/service'

import type { Instruccion } from './eventos'

/**
 * El lado del webhook: lo único de este proyecto que escribe el plan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ AQUÍ SÍ VA LA CLAVE DE SERVICIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Es el tercer uso legítimo, después del alta de despacho y del cron. Quien
 * llama es Stripe: no hay sesión, no hay usuario, y no puede haberlo — el cobro
 * ocurre cuando el titular ya cerró el navegador. Además, la `0012` blinda las
 * columnas de plan justamente para que **solo** la clave de servicio las mueva:
 * si esto se hiciera con la sesión del titular, el titular podría hacerlo solo.
 *
 * ⚠️ La puerta de entrada verifica la firma de Stripe ANTES de llamar a nada de
 * aquí. Un route handler con clave de servicio que no verifica quién llama es
 * acceso total a la base de todos los despachos, por HTTP y sin contraseña.
 */

export type ResultadoEvento =
  | { estado: 'repetido' }
  | { estado: 'ignorado'; motivo: string }
  | { estado: 'aplicado'; despachoId: string }
  | { estado: 'sin_despacho'; motivo: string }
  | { estado: 'falló'; motivo: string }

/**
 * Registra el evento y dice si es la primera vez que se ve.
 *
 * Stripe reintenta y, en algunos casos, manda dos eventos por un mismo hecho.
 * El índice único sobre `evento_id` es toda la idempotencia: si el insert
 * choca, ya se procesó.
 */
async function esNuevo(
  eventoId: string,
  tipo: string,
): Promise<boolean | 'error'> {
  const supabase = clienteServicio()
  const { error } = await supabase
    .from('suscripcion_eventos')
    .insert({ evento_id: eventoId, tipo })

  if (!error) return true
  // 23505 = unique_violation. Cualquier otro error es un problema de verdad.
  if (error.code === '23505') return false
  return 'error'
}

/** Deja el objeto del evento junto a su registro, para poder auditar después. */
async function guardarCarga(
  eventoId: string,
  despachoId: string | null,
  carga: unknown,
): Promise<void> {
  const supabase = clienteServicio()
  await supabase
    .from('suscripcion_eventos')
    .update({ despacho_id: despachoId, carga })
    .eq('evento_id', eventoId)
}

/** El despacho al que pertenece este cliente o esta suscripción de Stripe. */
async function buscarDespacho(
  despachoId: string | null,
  clienteId: string | null,
  suscripcionId: string | null,
): Promise<string | null> {
  if (despachoId) return despachoId

  const supabase = clienteServicio()

  if (suscripcionId) {
    const { data } = await supabase
      .from('despachos')
      .select('id')
      .eq('stripe_suscripcion_id', suscripcionId)
      .maybeSingle()
    if (data) return data.id
  }

  if (clienteId) {
    const { data } = await supabase
      .from('despachos')
      .select('id')
      .eq('stripe_cliente_id', clienteId)
      .maybeSingle()
    if (data) return data.id
  }

  return null
}

/**
 * Aplica lo que dice el evento.
 *
 * El evento ya viene verificado (firma) e interpretado (`eventos.ts`). Aquí
 * solo queda encontrar de qué despacho es y escribir la fila.
 */
export async function aplicarEvento(
  eventoId: string,
  tipo: string,
  instruccion: Instruccion,
  carga: unknown,
): Promise<ResultadoEvento> {
  const nuevo = await esNuevo(eventoId, tipo)

  if (nuevo === 'error') {
    // No se pudo registrar el evento. Se detiene: aplicar sin poder registrar
    // deja la puerta abierta a procesar el mismo cobro dos veces, y Stripe
    // reintenta lo que no contesta 200.
    await avisarAlOperador(
      'cobro',
      'No se pudo registrar un evento de Stripe',
      `Evento ${eventoId} (${tipo}). No se aplicó nada para no arriesgar un doble procesamiento.`,
    )
    return { estado: 'falló', motivo: 'No se pudo registrar el evento.' }
  }

  if (!nuevo) return { estado: 'repetido' }

  if (instruccion.tipo === 'ignorar') {
    await guardarCarga(eventoId, null, carga)
    return { estado: 'ignorado', motivo: instruccion.motivo }
  }

  const supabase = clienteServicio()

  if (instruccion.tipo === 'enlazar') {
    const { error } = await supabase
      .from('despachos')
      .update({
        stripe_cliente_id: instruccion.clienteId,
        ...(instruccion.suscripcionId
          ? { stripe_suscripcion_id: instruccion.suscripcionId }
          : {}),
      })
      .eq('id', instruccion.despachoId)

    await guardarCarga(eventoId, instruccion.despachoId, carga)

    if (error) {
      await avisarAlOperador(
        'cobro',
        'No se pudo enlazar un despacho con su cliente de Stripe',
        `Despacho ${instruccion.despachoId}, cliente ${instruccion.clienteId}: ${error.message}`,
      )
      return { estado: 'falló', motivo: error.message }
    }

    // El plan lo escribe `customer.subscription.created`, que llega junto con
    // este. Aquí solo se guarda a quién pertenece el cobro.
    return { estado: 'aplicado', despachoId: instruccion.despachoId }
  }

  const despachoId = await buscarDespacho(
    instruccion.despachoId,
    instruccion.clienteId,
    instruccion.suscripcionId,
  )

  if (!despachoId) {
    await guardarCarga(eventoId, null, carga)
    // No se pierde: queda la carga guardada para poder reconciliar a mano.
    await avisarAlOperador(
      'cobro',
      'Llegó un evento de Stripe sin despacho al cual aplicarlo',
      `Evento ${eventoId} (${tipo}), suscripción ${instruccion.suscripcionId}, cliente ${instruccion.clienteId ?? 'desconocido'}. Queda registrado en suscripcion_eventos.`,
    )
    return { estado: 'sin_despacho', motivo: 'No se encontró el despacho.' }
  }

  const { cambio } = instruccion

  const { error } = await supabase
    .from('despachos')
    .update({
      plan: cambio.plan,
      estado_suscripcion: cambio.estado,
      asientos_incluidos: cambio.asientos,
      expedientes_tope: cambio.expedientesTope,
      periodo_fin: instruccion.periodoFin,
      cancela_al_fin: instruccion.cancelaAlFin,
      stripe_suscripcion_id: instruccion.suscripcionId,
      ...(instruccion.clienteId ? { stripe_cliente_id: instruccion.clienteId } : {}),
    })
    .eq('id', despachoId)

  await guardarCarga(eventoId, despachoId, carga)

  if (error) {
    await avisarAlOperador(
      'cobro',
      'No se pudo aplicar un cambio de suscripción',
      `Despacho ${despachoId}, evento ${eventoId}: ${error.message}`,
    )
    return { estado: 'falló', motivo: error.message }
  }

  return { estado: 'aplicado', despachoId }
}

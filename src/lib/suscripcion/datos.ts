import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'

import type { Consumo, Suscripcion } from './limites'

/**
 * Lo que la pantalla y las Server Actions necesitan saber del cobro.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SI ESTO FALLA, DEJA PASAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuando no se puede leer la fila, se contesta "sin tope". Suena al revés, y no
 * lo es: **el candado de verdad son los disparadores de la `0012`**, que corren
 * dentro de la transacción y no se pueden esquivar. Lo de aquí es el aviso
 * temprano y el mensaje decente.
 *
 * Fallar cerrado aquí significaría que una consulta lenta le impide a un
 * litigante abrir el expediente del asunto que le acaban de traer. Fallar
 * abierto solo significa que, en ese caso raro, el mensaje lo da la base en vez
 * de la pantalla.
 */

const SIN_TOPE: Suscripcion = {
  plan: 'gratuito',
  estado: 'gratuita',
  asientos: Number.MAX_SAFE_INTEGER,
  expedientesTope: null,
  periodoFin: null,
  cancelaAlFin: false,
  tieneCliente: false,
}

export async function suscripcionDelDespacho(
  despachoId: string,
): Promise<Suscripcion> {
  const supabase = await clienteServidor()

  const { data, error } = await supabase
    .from('despachos')
    .select(
      'plan, estado_suscripcion, asientos_incluidos, expedientes_tope, periodo_fin, cancela_al_fin, stripe_cliente_id',
    )
    .eq('id', despachoId)
    .maybeSingle()

  if (error || !data) return SIN_TOPE

  return {
    plan: data.plan,
    estado: data.estado_suscripcion,
    asientos: data.asientos_incluidos,
    expedientesTope: data.expedientes_tope,
    periodoFin: data.periodo_fin,
    cancelaAlFin: data.cancela_al_fin,
    tieneCliente: data.stripe_cliente_id !== null,
  }
}

/**
 * Qué está usando el despacho.
 *
 * Los dos conteos van por función de la base (`0012`) y no por consulta: con la
 * RLS del usuario, un expediente restringido en el que no participa no se
 * contaría, y el tope se saltaría solo por no poder ver lo que se cuenta.
 */
export async function consumoDelDespacho(despachoId: string): Promise<Consumo> {
  const supabase = await clienteServidor()

  const [expedientes, asientos, invitaciones] = await Promise.all([
    supabase.rpc('expedientes_activos', { p_despacho: despachoId }),
    supabase.rpc('asientos_ocupados', { p_despacho: despachoId }),
    supabase
      .from('invitaciones')
      .select('id', { count: 'exact', head: true })
      .eq('despacho_id', despachoId)
      .eq('estado', 'pendiente')
      .gt('expira_el', new Date().toISOString()),
  ])

  return {
    expedientesActivos: expedientes.data ?? 0,
    asientosOcupados: asientos.data ?? 0,
    invitacionesPendientes: invitaciones.count ?? 0,
  }
}

export async function suscripcionYConsumo(
  despachoId: string,
): Promise<{ suscripcion: Suscripcion; consumo: Consumo }> {
  const [suscripcion, consumo] = await Promise.all([
    suscripcionDelDespacho(despachoId),
    consumoDelDespacho(despachoId),
  ])
  return { suscripcion, consumo }
}

/**
 * Los códigos con los que la base rechaza por tope (`0012`), traducidos.
 *
 * Existen para que un rechazo del disparador —el que sí es infalible— no
 * aparezca como "algo salió mal", que es la peor forma de enterarse de que se
 * llegó al tope del plan.
 */
export function mensajeDeTope(codigo: string | undefined): string | null {
  if (codigo === 'LIT01') {
    return 'Llegaste al tope de expedientes activos de tu plan. Concluye o archiva un asunto —no se borra nada— o pasa al plan de paga en Suscripción.'
  }
  if (codigo === 'LIT02') {
    return 'Ya no hay asientos libres en tu plan. Suma asientos en Suscripción, revoca una invitación pendiente o da de baja a alguien.'
  }
  return null
}

/**
 * El identificador de cliente de Stripe del despacho.
 *
 * Va aparte de `suscripcionDelDespacho` porque ahí solo interesa **si** existe,
 * no cuál es: el identificador se usa para abrir el cobro y no tiene por qué
 * llegar a ninguna pantalla.
 */
export async function clienteDeStripe(
  despachoId: string,
): Promise<string | null> {
  const supabase = await clienteServidor()
  const { data } = await supabase
    .from('despachos')
    .select('stripe_cliente_id')
    .eq('id', despachoId)
    .maybeSingle()
  return data?.stripe_cliente_id ?? null
}

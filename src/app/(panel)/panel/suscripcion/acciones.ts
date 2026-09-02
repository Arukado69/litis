'use server'

import { redirect } from 'next/navigation'

import { exigirPanel } from '@/lib/auth/sesion'
import { envSitioUrl } from '@/lib/supabase/env'
import {
  clienteDeStripe,
  consumoDelDespacho,
  suscripcionDelDespacho,
} from '@/lib/suscripcion/datos'
import { validarAsientos } from '@/lib/suscripcion/limites'
import { crearSesionDeCheckout, crearSesionDePortal } from '@/lib/suscripcion/stripe'

import {
  contratarConAviso,
  contratarConError,
  contratarConProblemas,
  type EstadoContratar,
} from './estado'

/**
 * Solo el titular contrata.
 *
 * Se verifica aquí además de en la `0012`, que blinda las columnas de plan
 * contra cualquier sesión. Esta comprobación es para dar un mensaje decente, no
 * para ser la cerradura.
 */
async function exigirTitular() {
  const sesion = await exigirPanel()
  return sesion.activa.rol === 'titular' ? sesion : null
}

/**
 * Abre el cobro por asiento al mes.
 *
 * Los datos de tarjeta **no pasan por este servidor**: se manda al titular al
 * Checkout hospedado de Stripe. Es la misma decisión que en el proyecto
 * anterior y por la misma razón — guardar tarjetas es un problema de
 * cumplimiento que un dev solo no tiene por qué tomar.
 */
export async function contratar(
  _previo: EstadoContratar,
  formData: FormData,
): Promise<EstadoContratar> {
  const sesion = await exigirTitular()
  const crudo = formData.get('asientos')
  const valores = { asientos: typeof crudo === 'string' ? crudo : '' }

  if (!sesion) {
    return contratarConError(
      valores,
      'Solo el titular del despacho contrata. Pídeselo a quien lo administra.',
    )
  }

  const asientos = Number.parseInt(valores.asientos, 10)
  const consumo = await consumoDelDespacho(sesion.activa.despachoId)
  const problema = validarAsientos(asientos, consumo)
  if (problema) return contratarConProblemas(valores, { asientos: problema })

  const suscripcion = await suscripcionDelDespacho(sesion.activa.despachoId)
  const clienteId = await clienteDeStripe(sesion.activa.despachoId)

  const sesionDeCobro = await crearSesionDeCheckout({
    despachoId: sesion.activa.despachoId,
    correo: sesion.correo,
    clienteId,
    asientos,
    origen: envSitioUrl(),
  })

  if (sesionDeCobro.estado === 'simulado') {
    return contratarConAviso(
      `No hay llaves de Stripe configuradas, así que no se cobró nada y tu plan sigue igual (${suscripcion.plan === 'gratuito' ? 'gratuito' : 'de paga'}). Con las llaves puestas, aquí se abriría el pago de ${asientos} asiento${asientos === 1 ? '' : 's'}.`,
    )
  }

  if (sesionDeCobro.estado === 'falló') {
    return contratarConError(
      valores,
      `No se pudo abrir el cobro (${sesionDeCobro.motivo}). Vuelve a intentarlo en un momento.`,
    )
  }

  redirect(sesionDeCobro.url)
}

/**
 * Manda al portal de facturación de Stripe: tarjeta, recibos, cantidad de
 * asientos y cancelación.
 *
 * Cancelar se hace ahí y no aquí a propósito. La baja de un servicio tiene
 * requisitos que cambian por país, y una pantalla propia que "cancele" sin
 * mover la suscripción de verdad es la peor versión posible de esto.
 */
export async function abrirPortalDeCobro(): Promise<void> {
  const sesion = await exigirTitular()
  if (!sesion) return

  const clienteId = await clienteDeStripe(sesion.activa.despachoId)
  if (!clienteId) return

  const portal = await crearSesionDePortal({
    clienteId,
    origen: envSitioUrl(),
  })

  if (portal.estado === 'listo') redirect(portal.url)
}

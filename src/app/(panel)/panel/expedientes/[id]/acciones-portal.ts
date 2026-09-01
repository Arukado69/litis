'use server'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import {
  enlaceDeInvitacion,
  expiraEl,
  generarToken,
  hashDeToken,
  normalizarCorreo,
} from '@/lib/despachos/invitaciones'
import { enviarConPlantilla } from '@/lib/email/envio'
import { obtenerExpediente } from '@/lib/expedientes/datos'
import { envSitioUrl } from '@/lib/supabase/env'
import { clienteServidor } from '@/lib/supabase/server'
import type { RolMembresia } from '@/types/db'

import type { EstadoInvitar } from './estado-portal'

/**
 * Dar de alta a un cliente en el portal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ LA PERSONA LA ELIGE EL DESPACHO, NO QUIEN ACEPTA
 * ─────────────────────────────────────────────────────────────────────────────
 * La invitación lleva el `persona_id` del cliente del expediente. Es el
 * despacho quien sabe que ese correo es el del representante de Constructora
 * XYZ; si la persona se eligiera al aceptar, quien reciba el enlace podría
 * vincularse a otro cliente del padrón y leer un expediente ajeno.
 *
 * De ahí en adelante, la RLS hace el resto: ese cliente ve los expedientes
 * donde SU persona es el cliente, y de la bitácora, los documentos y las
 * audiencias, solo lo marcado como visible.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO LO HACE UN ASISTENTE
 * ─────────────────────────────────────────────────────────────────────────────
 * Abrirle el expediente a alguien de fuera del despacho es una decisión sobre
 * el secreto profesional, no una captura.
 */
const PUEDE_DAR_ACCESO: readonly RolMembresia[] = ['titular', 'abogado']

const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function conError(campos: Record<string, string>, error: string): EstadoInvitar {
  return { valores: campos, error, problemas: {}, enlace: null, aviso: null }
}

export async function darAccesoAlCliente(
  _previo: EstadoInvitar,
  formData: FormData,
): Promise<EstadoInvitar> {
  const sesion = await exigirPanel()
  const campos: Record<string, string> = {}
  for (const [k, v] of formData.entries()) if (typeof v === 'string') campos[k] = v

  const expedienteId = campos.expedienteId ?? ''
  const correo = normalizarCorreo(campos.correo)

  if (!PUEDE_DAR_ACCESO.includes(sesion.activa.rol)) {
    return conError(
      campos,
      'Abrirle el expediente a alguien de fuera del despacho lo decide el titular o el abogado responsable.',
    )
  }

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) return conError(campos, 'No se encontró el expediente.')

  if (!expediente.clientePersonaId) {
    // Sin persona del padrón no hay a qué vincular la cuenta, y la RLS del
    // portal se apoya justo en ese enlace.
    return conError(
      campos,
      'Este expediente no tiene un cliente del padrón asignado, así que no hay a quién darle acceso.',
    )
  }

  if (!PATRON_CORREO.test(correo)) {
    return {
      valores: campos,
      error: null,
      problemas: { correo: 'Escribe un correo válido.' },
      enlace: null,
      aviso: null,
    }
  }

  const supabase = await clienteServidor()

  // Una sola invitación pendiente por correo y despacho: lo impide el índice
  // único de la 0009, pero se avisa antes para dar un mensaje decente.
  const { data: yaHay } = await supabase
    .from('invitaciones')
    .select('id')
    .eq('despacho_id', sesion.activa.despachoId)
    .eq('correo', correo)
    .eq('estado', 'pendiente')
    .maybeSingle()

  if (yaHay) {
    return conError(
      campos,
      'Ya hay una invitación pendiente para ese correo. Revócala desde Equipo si quieres mandar otra.',
    )
  }

  const token = generarToken()

  const { error } = await supabase.from('invitaciones').insert({
    despacho_id: sesion.activa.despachoId,
    correo,
    rol: 'cliente',
    persona_id: expediente.clientePersonaId,
    token_hash: hashDeToken(token),
    expira_el: expiraEl().toISOString(),
    invitada_por: sesion.usuarioId,
  })

  if (error) {
    return conError(campos, 'No se pudo crear el acceso. Vuelve a intentarlo.')
  }

  const enlace = enlaceDeInvitacion(envSitioUrl(), token)

  const envio = await enviarConPlantilla(correo, {
    titulo: `${sesion.activa.despachoNombre} te dio acceso a tu asunto`,
    parrafos: [
      `${sesion.nombre || sesion.correo}, de ${sesion.activa.despachoNombre}, te abrió un acceso para consultar cómo va tu asunto: ${expediente.caratula}.`,
      'Vas a poder ver en qué etapa está, tus próximas audiencias y los documentos que tu abogado comparta contigo. Es solo de consulta.',
    ],
    boton: { texto: 'Entrar a ver mi asunto', url: enlace },
    enlaceLiteral: enlace,
    pie: `El enlace caduca en 7 días y solo funciona con la cuenta de ${correo}.`,
  })

  revalidatePath(`/panel/expedientes/${expedienteId}`)

  return {
    valores: {},
    error: null,
    problemas: {},
    enlace,
    aviso:
      envio.estado === 'enviado'
        ? `Se le mandó el acceso a ${correo}.`
        : envio.estado === 'simulado'
          ? 'No hay proveedor de correo configurado, así que el correo no salió. Copia el enlace y mándaselo tú.'
          : `El acceso quedó creado, pero el correo no salió (${envio.motivo}). Copia el enlace y mándaselo tú.`,
  }
}

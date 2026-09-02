'use server'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import { equipoDelDespacho, invitacionesPendientes } from '@/lib/despachos/equipo'
import {
  enlaceDeInvitacion,
  expiraEl,
  generarToken,
  hashDeToken,
  leerInvitacion,
  normalizarCorreo,
  puedeCambiarRol,
  puedeDarDeBaja,
  ROLES_INVITABLES,
  ROL_MEMBRESIA_ETIQUETA,
  validarInvitacion,
} from '@/lib/despachos/invitaciones'
import { enviarConPlantilla } from '@/lib/email/envio'
import { envSitioUrl } from '@/lib/supabase/env'
import { clienteServidor } from '@/lib/supabase/server'
import { suscripcionYConsumo } from '@/lib/suscripcion/datos'
import { puedeSumarAsiento } from '@/lib/suscripcion/limites'
import type { RolMembresia } from '@/types/db'

import {
  invitarConError,
  invitarConProblemas,
  type EstadoInvitar,
} from './estado'

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

/**
 * Solo el titular administra el equipo.
 *
 * Se verifica aquí **además** de en la RLS de la `0009`. La política es la red
 * final y basta para que nada se escriba; esta comprobación existe para que un
 * abogado que llegue a la pantalla vea un mensaje claro en vez de un error de
 * base de datos, y para que la regla esté escrita donde se lee el flujo.
 */
async function exigirTitular() {
  const sesion = await exigirPanel()
  if (sesion.activa.rol !== 'titular') return null
  return sesion
}

/**
 * Crea una invitación y manda el enlace.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL TOKEN EN CLARO VIVE UNA SOLA VEZ
 * ─────────────────────────────────────────────────────────────────────────────
 * Se genera aquí, se hashea, y a la base va solo el sha-256. El claro sale en
 * el correo y en la respuesta de esta acción —para que el titular lo pueda
 * copiar por WhatsApp— y después no existe en ningún lado. Perder el enlace
 * obliga a revocar y reinvitar, que es exactamente lo correcto: si se pudiera
 * recuperar, cualquiera con lectura de la tabla podría entrar a cualquier
 * despacho con invitación abierta.
 */
export async function invitarAlEquipo(
  _previo: EstadoInvitar,
  formData: FormData,
): Promise<EstadoInvitar> {
  const sesion = await exigirTitular()
  const campos = comoCampos(formData)

  if (!sesion) {
    return invitarConError(
      campos,
      'Solo el titular del despacho puede invitar. Pídeselo a quien lo administra.',
    )
  }

  const despachoId = sesion.activa.despachoId
  const captura = leerInvitacion(campos)

  const [equipo, pendientes] = await Promise.all([
    equipoDelDespacho(despachoId),
    invitacionesPendientes(despachoId),
  ])

  const problemasCaptura = validarInvitacion(captura, {
    correosDelEquipo: equipo.map((m) => normalizarCorreo(m.correo ?? '')),
    correosInvitados: pendientes.map((i) => normalizarCorreo(i.correo)),
    correoDeQuienInvita: sesion.correo,
  })

  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return invitarConProblemas(campos, problemas)
  }

  // El asiento se aparta al invitar, no al aceptar. Si se cobrara solo al
  // aceptar, se mandan veinte invitaciones con un asiento pagado y el tope
  // aparece cuando ya están todos adentro — el peor momento para enterarse.
  const { suscripcion, consumo } = await suscripcionYConsumo(despachoId)
  const cupo = puedeSumarAsiento(suscripcion, consumo)
  if (!cupo.permitido) {
    return invitarConError(campos, `${cupo.motivo} ${cupo.salida}`)
  }

  const token = generarToken()
  const supabase = await clienteServidor()

  const { error } = await supabase.from('invitaciones').insert({
    despacho_id: despachoId,
    correo: captura.correo,
    rol: captura.rol,
    token_hash: hashDeToken(token),
    expira_el: expiraEl().toISOString(),
    invitada_por: sesion.usuarioId,
  })

  if (error) {
    return invitarConError(
      campos,
      'No se pudo crear la invitación. Vuelve a intentarlo.',
    )
  }

  // ⚠️ El origen sale de la configuración, NUNCA del header `Host`: quien manda
  // la petición lo controla, y con él haría que el correo legítimo llevara el
  // token a su propio servidor.
  const enlace = enlaceDeInvitacion(envSitioUrl(), token)

  const envio = await enviarConPlantilla(captura.correo, {
    titulo: `${sesion.activa.despachoNombre} te invitó a su despacho`,
    parrafos: [
      `${sesion.nombre || sesion.correo} te invitó a trabajar en ${sesion.activa.despachoNombre} como ${ROL_MEMBRESIA_ETIQUETA[captura.rol].toLowerCase()}.`,
      'Al aceptar vas a ver los expedientes del despacho, sus plazos y sus audiencias. Si no esperabas esta invitación, ignora este correo.',
    ],
    boton: { texto: 'Aceptar la invitación', url: enlace },
    enlaceLiteral: enlace,
    pie: `El enlace caduca en 7 días y solo funciona con la cuenta de ${captura.correo}.`,
  })

  revalidatePath('/panel/equipo')

  const aviso =
    envio.estado === 'enviado'
      ? `Invitación enviada a ${captura.correo}.`
      : envio.estado === 'simulado'
        ? 'No hay proveedor de correo configurado, así que el correo no salió. Copia el enlace y mándaselo tú.'
        : `La invitación quedó creada, pero el correo no salió (${envio.motivo}). Copia el enlace y mándaselo tú.`

  return { valores: {}, error: null, problemas: {}, enlace, aviso }
}

/**
 * Revoca una invitación pendiente.
 *
 * No se borra la fila: se marca `revocada`. Borrarla dejaría el índice único de
 * pendientes libre y, sobre todo, borraría el rastro de que alguien fue
 * invitado y luego no — que es justo lo que querría ver quien audite quién tuvo
 * acceso a los expedientes.
 */
export async function revocarInvitacion(formData: FormData): Promise<void> {
  const sesion = await exigirTitular()
  if (!sesion) return

  const id = formData.get('invitacionId')
  if (typeof id !== 'string' || id.length === 0) return

  const supabase = await clienteServidor()
  await supabase
    .from('invitaciones')
    .update({ estado: 'revocada' })
    .eq('id', id)
    .eq('despacho_id', sesion.activa.despachoId)
    .eq('estado', 'pendiente')

  revalidatePath('/panel/equipo')
}

/**
 * Da de baja a alguien del equipo.
 *
 * ⚠️ **No se borra la membresía: se suspende.** Las actuaciones de la bitácora,
 * los plazos cerrados y los expedientes apuntan a ese perfil. Borrarlo dejaría
 * la historia del despacho firmada por nadie, y la bitácora es lo único que no
 * se puede reconstruir.
 *
 * Con `suspendida` la persona deja de pasar `es_miembro()` y por lo tanto deja
 * de ver un solo expediente, pero su nombre sigue ligado a lo que hizo.
 */
export async function darDeBaja(formData: FormData): Promise<void> {
  const sesion = await exigirTitular()
  if (!sesion) return

  const perfilId = formData.get('perfilId')
  if (typeof perfilId !== 'string' || perfilId.length === 0) return

  const equipo = await equipoDelDespacho(sesion.activa.despachoId)
  const miembro = equipo.find((m) => m.perfilId === perfilId)
  if (!miembro) return
  if (puedeDarDeBaja(miembro, sesion.usuarioId)) return

  const supabase = await clienteServidor()
  await supabase
    .from('membresias')
    .update({ estado: 'suspendida' })
    .eq('despacho_id', sesion.activa.despachoId)
    .eq('perfil_id', perfilId)

  revalidatePath('/panel/equipo')
  revalidatePath('/panel')
}

/** Reactiva a alguien que se había dado de baja. */
export async function reactivar(formData: FormData): Promise<void> {
  const sesion = await exigirTitular()
  if (!sesion) return

  const perfilId = formData.get('perfilId')
  if (typeof perfilId !== 'string' || perfilId.length === 0) return

  const supabase = await clienteServidor()
  await supabase
    .from('membresias')
    .update({ estado: 'activa' })
    .eq('despacho_id', sesion.activa.despachoId)
    .eq('perfil_id', perfilId)
    .neq('rol', 'cliente')

  revalidatePath('/panel/equipo')
}

/** Cambia el papel de alguien del equipo. */
export async function cambiarRol(formData: FormData): Promise<void> {
  const sesion = await exigirTitular()
  if (!sesion) return

  const perfilId = formData.get('perfilId')
  const rol = formData.get('rol')
  if (typeof perfilId !== 'string' || typeof rol !== 'string') return
  if (!ROLES_INVITABLES.includes(rol as RolMembresia)) return

  const equipo = await equipoDelDespacho(sesion.activa.despachoId)
  const miembro = equipo.find((m) => m.perfilId === perfilId)
  if (!miembro) return
  if (puedeCambiarRol(miembro, rol as RolMembresia)) return

  const supabase = await clienteServidor()
  await supabase
    .from('membresias')
    .update({ rol: rol as RolMembresia })
    .eq('despacho_id', sesion.activa.despachoId)
    .eq('perfil_id', perfilId)

  revalidatePath('/panel/equipo')
}

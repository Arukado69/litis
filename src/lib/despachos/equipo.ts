import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'
import type { EstadoInvitacion, RolMembresia } from '@/types/db'

/**
 * Consultas del equipo del despacho.
 *
 * ⚠️ Todo aquí filtra por `despacho_id` de forma **explícita**, además de la
 * RLS. La política de `invitaciones` ya limita al titular de ese despacho, pero
 * un filtro escrito en la consulta es lo que evita que un cambio futuro en la
 * política —o un `select` que se copie a otro contexto— abra la puerta sin que
 * nadie lo note.
 */

export interface MiembroDelEquipo {
  perfilId: string
  nombre: string
  correo: string | null
  rol: RolMembresia
  estado: string
  desdeEl: string
}

export interface InvitacionPendiente {
  id: string
  correo: string
  rol: RolMembresia
  estado: EstadoInvitacion
  expiraEl: string
  creadoEl: string
}

/** El equipo completo, incluidas las bajas: quien firmó una actuación sigue ahí. */
export async function equipoDelDespacho(
  despachoId: string,
): Promise<MiembroDelEquipo[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('membresias')
    .select('perfil_id, rol, estado, creado_el, perfiles:perfil_id(nombre, correo)')
    .eq('despacho_id', despachoId)
    .neq('rol', 'cliente')
    .order('creado_el')

  return (data ?? []).flatMap((fila) => {
    const perfil = Array.isArray(fila.perfiles) ? fila.perfiles[0] : fila.perfiles
    if (!perfil) return []
    return [
      {
        perfilId: fila.perfil_id,
        nombre: perfil.nombre || perfil.correo || 'Sin nombre',
        correo: perfil.correo,
        rol: fila.rol,
        estado: fila.estado,
        desdeEl: fila.creado_el,
      },
    ]
  })
}

/** Las invitaciones que siguen abiertas. Las aceptadas ya son membresías. */
export async function invitacionesPendientes(
  despachoId: string,
): Promise<InvitacionPendiente[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('invitaciones')
    // El `token_hash` NO se trae: no lo necesita ninguna pantalla, y lo que no
    // sale de la base no se filtra por un registro ni por una captura.
    .select('id, correo, rol, estado, expira_el, creado_el')
    .eq('despacho_id', despachoId)
    .eq('estado', 'pendiente')
    .order('creado_el', { ascending: false })

  return (data ?? []).map((i) => ({
    id: i.id,
    correo: i.correo,
    rol: i.rol,
    estado: i.estado,
    expiraEl: i.expira_el,
    creadoEl: i.creado_el,
  }))
}

/**
 * Cuántos pendientes vivos tiene cada persona a su nombre.
 *
 * Existe para que dar de baja a alguien no sea una decisión a ciegas: si Danny
 * se va con cuatro plazos corriendo, esos cuatro plazos quedan a nombre de
 * alguien que ya no entra, y el titular tiene que saberlo ANTES de oprimir el
 * botón, no cuando se venza el primero.
 */
export async function cargaPorPersona(
  despachoId: string,
): Promise<ReadonlyMap<string, number>> {
  const supabase = await clienteServidor()

  const [plazos, audiencias] = await Promise.all([
    supabase
      .from('plazos')
      .select('responsable_id, expedientes:expediente_id!inner(despacho_id)')
      .eq('estado', 'pendiente')
      .eq('expedientes.despacho_id', despachoId)
      .not('responsable_id', 'is', null),
    supabase
      .from('audiencias')
      .select('responsable_id, expedientes:expediente_id!inner(despacho_id)')
      .eq('estado', 'programada')
      .eq('expedientes.despacho_id', despachoId)
      .not('responsable_id', 'is', null),
  ])

  const carga = new Map<string, number>()
  for (const fila of [...(plazos.data ?? []), ...(audiencias.data ?? [])]) {
    const id = fila.responsable_id
    if (!id) continue
    carga.set(id, (carga.get(id) ?? 0) + 1)
  }
  return carga
}

/**
 * Los perfiles que ya no están activos en el despacho.
 *
 * El panel los necesita: un pendiente a nombre de alguien dado de baja no tiene
 * quien lo vea, y sin esto se vería con responsable —con su nombre y todo— y
 * pasaría desapercibido justo en la lista que existe para que nada pase
 * desapercibido.
 */
export async function perfilesInactivos(
  despachoId: string,
): Promise<ReadonlySet<string>> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('membresias')
    .select('perfil_id')
    .eq('despacho_id', despachoId)
    .neq('estado', 'activa')

  return new Set((data ?? []).map((m) => m.perfil_id))
}

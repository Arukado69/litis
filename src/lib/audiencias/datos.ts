import 'server-only'

import { perfilesInactivos } from '@/lib/despachos/equipo'
import { clienteServidor } from '@/lib/supabase/server'

import type { AudienciaEnAgenda, VencimientoEnAgenda } from './agenda'

/**
 * Consultas de la agenda.
 *
 * ⚠️ Ni `audiencias` ni `plazos` tienen `despacho_id` propio: cuelgan del
 * expediente. La RLS ya limita a lo visible, y aquí se filtra además por
 * despacho de forma explícita — un filtro escrito en la consulta es lo que
 * evita que un cambio futuro en la política abra la puerta sin que nadie note.
 *
 * ⚠️ Igual que en el panel, un pendiente a nombre de alguien dado de baja
 * cuenta como SIN responsable: nadie que ya no entra al sistema lo está viendo.
 */

const TOPE = 2000

export async function audienciasDelDespacho(
  despachoId: string,
): Promise<AudienciaEnAgenda[]> {
  const supabase = await clienteServidor()
  const inactivos = await perfilesInactivos(despachoId)

  const { data } = await supabase
    .from('audiencias')
    .select(
      'id, tipo, fecha, hora, lugar, estado, responsable_id, expediente_id, expedientes:expediente_id(despacho_id, numero_interno, numero_organo, caratula), perfiles:responsable_id(nombre)',
    )
    .order('fecha')
    .limit(TOPE)

  return (data ?? []).flatMap((a) => {
    const exp = Array.isArray(a.expedientes) ? a.expedientes[0] : a.expedientes
    if (!exp || exp.despacho_id !== despachoId) return []

    const perfil = Array.isArray(a.perfiles) ? a.perfiles[0] : a.perfiles
    const huerfana = a.responsable_id !== null && inactivos.has(a.responsable_id)

    return [
      {
        id: a.id,
        expedienteId: a.expediente_id,
        numeroExpediente: exp.numero_organo ?? exp.numero_interno,
        caratula: exp.caratula,
        tipo: a.tipo,
        fecha: a.fecha,
        hora: a.hora ? String(a.hora).slice(0, 5) : null,
        lugar: a.lugar,
        estado: a.estado,
        responsableId: huerfana ? null : a.responsable_id,
        responsableNombre: huerfana ? null : (perfil?.nombre ?? null),
      },
    ]
  })
}

export async function vencimientosDelDespacho(
  despachoId: string,
): Promise<VencimientoEnAgenda[]> {
  const supabase = await clienteServidor()
  const inactivos = await perfilesInactivos(despachoId)

  const { data } = await supabase
    .from('plazos')
    .select(
      'id, etiqueta, fecha_vencimiento_efectiva, responsable_id, expediente_id, expedientes:expediente_id(despacho_id, numero_interno, numero_organo, caratula), perfiles:responsable_id(nombre)',
    )
    .eq('estado', 'pendiente')
    .order('fecha_vencimiento_efectiva')
    .limit(TOPE)

  return (data ?? []).flatMap((p) => {
    const exp = Array.isArray(p.expedientes) ? p.expedientes[0] : p.expedientes
    if (!exp || exp.despacho_id !== despachoId) return []

    const perfil = Array.isArray(p.perfiles) ? p.perfiles[0] : p.perfiles
    const huerfano = p.responsable_id !== null && inactivos.has(p.responsable_id)

    return [
      {
        id: p.id,
        expedienteId: p.expediente_id,
        numeroExpediente: exp.numero_organo ?? exp.numero_interno,
        caratula: exp.caratula,
        etiqueta: p.etiqueta,
        fecha: p.fecha_vencimiento_efectiva,
        responsableId: huerfano ? null : p.responsable_id,
        responsableNombre: huerfano ? null : (perfil?.nombre ?? null),
      },
    ]
  })
}

/** Las de un expediente, en todos sus estados. Para la ficha. */
export async function audienciasDelExpediente(
  expedienteId: string,
): Promise<AudienciaEnAgenda[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('audiencias')
    .select(
      'id, tipo, fecha, hora, lugar, estado, responsable_id, expediente_id, perfiles:responsable_id(nombre)',
    )
    .eq('expediente_id', expedienteId)
    .order('fecha', { ascending: false })

  return (data ?? []).map((a) => {
    const perfil = Array.isArray(a.perfiles) ? a.perfiles[0] : a.perfiles
    return {
      id: a.id,
      expedienteId: a.expediente_id,
      numeroExpediente: '',
      caratula: '',
      tipo: a.tipo,
      fecha: a.fecha,
      hora: a.hora ? String(a.hora).slice(0, 5) : null,
      lugar: a.lugar,
      estado: a.estado,
      responsableId: a.responsable_id,
      responsableNombre: perfil?.nombre ?? null,
    }
  })
}

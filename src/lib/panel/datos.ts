import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'

import type { AudienciaDelPanel, PlazoDelPanel } from './pendientes'

/**
 * Consultas del panel "qué vence".
 *
 * Traen TODO el despacho, no solo lo del usuario: un plazo de un compañero que
 * está de vacaciones sigue siendo un plazo del despacho, y el titular necesita
 * verlo. El filtro por persona, si algún día se quiere, va en la pantalla.
 *
 * ⚠️ `plazos` y `audiencias` no tienen `despacho_id` propio: cuelgan del
 * expediente. La RLS ya limita a lo visible, y aquí se filtra además por
 * despacho en memoria para no depender solo de la política.
 */

/** Tope de filas por consulta. Un despacho chico no se acerca; evita traer de más. */
const TOPE = 2000

export async function plazosPendientes(
  despachoId: string,
): Promise<PlazoDelPanel[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('plazos')
    .select(
      'id, etiqueta, calendario_id, fecha_vencimiento_efectiva, confiabilidad, responsable_id, expediente_id, expedientes:expediente_id(despacho_id, numero_interno, caratula), perfiles:responsable_id(nombre)',
    )
    // Solo lo que sigue corriendo: un plazo atendido o cancelado no es trabajo
    // pendiente, y dejarlo en la lista enseña a ignorarla.
    .eq('estado', 'pendiente')
    .order('fecha_vencimiento_efectiva')
    .limit(TOPE)

  return (data ?? []).flatMap((p) => {
    const exp = Array.isArray(p.expedientes) ? p.expedientes[0] : p.expedientes
    if (!exp || exp.despacho_id !== despachoId) return []

    const perfil = Array.isArray(p.perfiles) ? p.perfiles[0] : p.perfiles

    return [
      {
        id: p.id,
        calendarioId: p.calendario_id,
        expedienteId: p.expediente_id,
        numeroInterno: exp.numero_interno,
        caratula: exp.caratula,
        etiqueta: p.etiqueta,
        fechaVencimiento: p.fecha_vencimiento_efectiva,
        responsableId: p.responsable_id,
        responsableNombre: perfil?.nombre ?? null,
        confiabilidad:
          p.confiabilidad === 'verificado_por_despacho'
            ? ('verificado_por_despacho' as const)
            : ('semilla_no_verificada' as const),
      },
    ]
  })
}

export async function audienciasProgramadas(
  despachoId: string,
): Promise<AudienciaDelPanel[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('audiencias')
    .select(
      'id, tipo, fecha, hora, lugar, responsable_id, expediente_id, expedientes:expediente_id(despacho_id, numero_interno, caratula), perfiles:responsable_id(nombre)',
    )
    .eq('estado', 'programada')
    .order('fecha')
    .limit(TOPE)

  return (data ?? []).flatMap((a) => {
    const exp = Array.isArray(a.expedientes) ? a.expedientes[0] : a.expedientes
    if (!exp || exp.despacho_id !== despachoId) return []

    const perfil = Array.isArray(a.perfiles) ? a.perfiles[0] : a.perfiles

    return [
      {
        id: a.id,
        // La audiencia no guarda calendario: su fecha es exacta y los días
        // hábiles restantes son solo una referencia. Cae al de por omisión.
        calendarioId: null,
        expedienteId: a.expediente_id,
        numeroInterno: exp.numero_interno,
        caratula: exp.caratula,
        tipo: a.tipo,
        fecha: a.fecha,
        hora: a.hora,
        lugar: a.lugar,
        responsableId: a.responsable_id,
        responsableNombre: perfil?.nombre ?? null,
      },
    ]
  })
}

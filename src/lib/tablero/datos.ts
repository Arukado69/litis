import 'server-only'

import { buscarVia } from '@/lib/expedientes/materias'
import { clienteServidor } from '@/lib/supabase/server'

import type { ExpedienteEnTablero } from './fases'

/**
 * Los expedientes del tablero.
 *
 * ⚠️ **Solo los que se mueven.** Un asunto concluido o archivado no entra: el
 * tablero contesta "en qué va lo que está vivo", y llenarlo de expedientes
 * cerrados lo vuelve un inventario que nadie lee. Los suspendidos sí entran,
 * marcados: siguen siendo del despacho y en algún momento se reanudan.
 */

const TOPE = 1000

export async function expedientesDelTablero(
  despachoId: string,
): Promise<ExpedienteEnTablero[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('expedientes')
    .select(
      'id, numero_interno, numero_organo, caratula, via, etapa_actual, estado, actualizado_el, responsable_id, perfiles:responsable_id(nombre)',
    )
    .eq('despacho_id', despachoId)
    .in('estado', ['activo', 'suspendido', 'prospecto'])
    .limit(TOPE)

  const expedientes = data ?? []
  if (expedientes.length === 0) return []

  const ids = expedientes.map((e) => e.id)

  // Dos consultas más, en lote: los nombres de las etapas actuales y las
  // paralelas, y los plazos vivos. Traerlas por expediente serían N+1.
  const [{ data: etapas }, { data: plazos }] = await Promise.all([
    supabase
      .from('expediente_etapas')
      .select('expediente_id, clave, nombre, paralela')
      .in('expediente_id', ids),
    supabase
      .from('plazos')
      .select('expediente_id, fecha_vencimiento_efectiva')
      .in('expediente_id', ids)
      .eq('estado', 'pendiente')
      .order('fecha_vencimiento_efectiva'),
  ])

  const nombrePorEtapa = new Map<string, string>()
  const paralelasPorExpediente = new Map<string, string[]>()
  for (const e of etapas ?? []) {
    nombrePorEtapa.set(`${e.expediente_id}:${e.clave}`, e.nombre)
    if (e.paralela) {
      const lista = paralelasPorExpediente.get(e.expediente_id) ?? []
      lista.push(e.nombre)
      paralelasPorExpediente.set(e.expediente_id, lista)
    }
  }

  const plazosPorExpediente = new Map<string, string[]>()
  for (const p of plazos ?? []) {
    const lista = plazosPorExpediente.get(p.expediente_id) ?? []
    lista.push(p.fecha_vencimiento_efectiva)
    plazosPorExpediente.set(p.expediente_id, lista)
  }

  return expedientes.map((e) => {
    const perfil = Array.isArray(e.perfiles) ? e.perfiles[0] : e.perfiles
    const vencimientos = plazosPorExpediente.get(e.id) ?? []

    return {
      id: e.id,
      numeroInterno: e.numero_interno,
      numeroOrgano: e.numero_organo,
      caratula: e.caratula,
      via: e.via,
      viaNombre: buscarVia(e.via)?.nombre ?? e.via,
      etapaClave: e.etapa_actual,
      etapaNombre: e.etapa_actual
        ? (nombrePorEtapa.get(`${e.id}:${e.etapa_actual}`) ?? e.etapa_actual)
        : null,
      estado: e.estado,
      responsableNombre: perfil?.nombre ?? null,
      paralelas: paralelasPorExpediente.get(e.id) ?? [],
      plazosVivos: vencimientos.length,
      proximoVencimiento: vencimientos[0] ?? null,
      actualizadoEl: e.actualizado_el,
    }
  })
}

/** Las etapas del avance de un expediente, para el selector de la tarjeta. */
export async function etapasParaMover(
  expedienteIds: readonly string[],
): Promise<ReadonlyMap<string, { clave: string; nombre: string }[]>> {
  if (expedienteIds.length === 0) return new Map()

  const supabase = await clienteServidor()
  const { data } = await supabase
    .from('expediente_etapas')
    .select('expediente_id, clave, nombre, orden, paralela')
    .in('expediente_id', [...expedienteIds])
    .eq('paralela', false)
    .order('orden')

  const mapa = new Map<string, { clave: string; nombre: string }[]>()
  for (const e of data ?? []) {
    const lista = mapa.get(e.expediente_id) ?? []
    lista.push({ clave: e.clave, nombre: e.nombre })
    mapa.set(e.expediente_id, lista)
  }
  return mapa
}

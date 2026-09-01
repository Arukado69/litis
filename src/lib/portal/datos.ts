import 'server-only'

import { buscarVia } from '@/lib/expedientes/materias'
import { clienteServidor } from '@/lib/supabase/server'

/**
 * Lo que ve un cliente en su portal.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ SE FILTRA POR SU PERSONA, ADEMÁS DE LA RLS
 * ─────────────────────────────────────────────────────────────────────────────
 * La política de `expedientes` ya limita al cliente a los suyos
 * (`cliente_persona_id = persona_del_usuario()`), y la de `actuaciones`,
 * `documentos` y `audiencias` ya exige `visible_cliente`. Aquí se vuelve a
 * filtrar de forma explícita.
 *
 * No es desconfianza en la política: es que estas consultas son las únicas del
 * sistema donde un error deja a una persona leyendo el expediente de otra, y un
 * filtro escrito en el `where` es lo que sobrevive a que alguien copie la
 * consulta a otro contexto.
 *
 * **Aquí NO se consultan plazos.** No es un olvido: el cliente no los ve por
 * decisión de la `0005`, y ni siquiera existe la consulta para que nadie la
 * "arregle" más tarde.
 */

export interface AsuntoDelCliente {
  id: string
  numeroInterno: string
  numeroOrgano: string | null
  caratula: string
  via: string
  viaNombre: string
  materia: string
  etapaClave: string | null
  estado: string
  responsableNombre: string | null
  /** Del último movimiento visible para el cliente, no de cualquier cambio. */
  ultimoMovimientoEl: string | null
}

export interface AudienciaDelCliente {
  id: string
  tipo: string
  fecha: string
  hora: string | null
  lugar: string | null
}

export interface MovimientoDelCliente {
  id: string
  fecha: string
  titulo: string
  detalle: string | null
}

export interface DocumentoDelCliente {
  id: string
  nombre: string
  tipo: string
  creadoEl: string
}

/** Los asuntos del cliente que hay sesión iniciada. */
export async function asuntosDelCliente(
  despachoId: string,
  personaId: string,
): Promise<AsuntoDelCliente[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('expedientes')
    .select(
      'id, numero_interno, numero_organo, caratula, via, materia, etapa_actual, estado, responsable_id, perfiles:responsable_id(nombre)',
    )
    .eq('despacho_id', despachoId)
    .eq('cliente_persona_id', personaId)
    .order('creado_el', { ascending: false })

  const asuntos = data ?? []
  if (asuntos.length === 0) return []

  // El "último movimiento" que le importa al cliente es el último hecho que él
  // puede ver, no la última vez que alguien tocó un campo interno.
  const { data: visibles } = await supabase
    .from('actuaciones')
    .select('expediente_id, fecha')
    .in(
      'expediente_id',
      asuntos.map((a) => a.id),
    )
    .eq('visible_cliente', true)
    .order('fecha', { ascending: false })

  const ultimo = new Map<string, string>()
  for (const a of visibles ?? []) {
    if (!ultimo.has(a.expediente_id)) ultimo.set(a.expediente_id, a.fecha)
  }

  return asuntos.map((e) => {
    const perfil = Array.isArray(e.perfiles) ? e.perfiles[0] : e.perfiles
    return {
      id: e.id,
      numeroInterno: e.numero_interno,
      numeroOrgano: e.numero_organo,
      caratula: e.caratula,
      via: e.via,
      viaNombre: buscarVia(e.via)?.nombre ?? e.via,
      materia: e.materia,
      etapaClave: e.etapa_actual,
      estado: e.estado,
      responsableNombre: perfil?.nombre ?? null,
      ultimoMovimientoEl: ultimo.get(e.id) ?? null,
    }
  })
}

/** Un asunto concreto, verificando que sea de esta persona. */
export async function asuntoDelCliente(
  despachoId: string,
  personaId: string,
  expedienteId: string,
): Promise<AsuntoDelCliente | null> {
  const todos = await asuntosDelCliente(despachoId, personaId)
  return todos.find((a) => a.id === expedienteId) ?? null
}

export async function audienciasVisibles(
  expedienteId: string,
): Promise<AudienciaDelCliente[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('audiencias')
    .select('id, tipo, fecha, hora, lugar, estado, visible_cliente')
    .eq('expediente_id', expedienteId)
    .eq('visible_cliente', true)
    .eq('estado', 'programada')
    .order('fecha')

  return (data ?? []).map((a) => ({
    id: a.id,
    tipo: a.tipo,
    fecha: a.fecha,
    hora: a.hora ? String(a.hora).slice(0, 5) : null,
    lugar: a.lugar,
  }))
}

export async function movimientosVisibles(
  expedienteId: string,
): Promise<MovimientoDelCliente[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('actuaciones')
    .select('id, fecha, titulo, detalle, visible_cliente')
    .eq('expediente_id', expedienteId)
    .eq('visible_cliente', true)
    .order('fecha', { ascending: false })
    .limit(100)

  return (data ?? []).map((a) => ({
    id: a.id,
    fecha: a.fecha,
    titulo: a.titulo,
    detalle: a.detalle,
  }))
}

export async function documentosVisibles(
  expedienteId: string,
): Promise<DocumentoDelCliente[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('documentos')
    .select('id, nombre, tipo, creado_el, visible_cliente')
    .eq('expediente_id', expedienteId)
    .eq('visible_cliente', true)
    .order('creado_el', { ascending: false })

  return (data ?? []).map((d) => ({
    id: d.id,
    nombre: d.nombre,
    tipo: d.tipo,
    creadoEl: d.creado_el,
  }))
}

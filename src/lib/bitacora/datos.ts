import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'
import type { TipoActuacion, TipoDocumento } from '@/types/db'

/**
 * Lectura de la bitácora y de los documentos de un expediente.
 *
 * La RLS de `actuaciones` ya decide qué ve cada quien —el personal todo, el
 * cliente solo lo marcado visible—, así que aquí no se repite el filtro: la
 * condición vive en la política, que es donde no se puede olvidar.
 */

export interface ActuacionEnBitacora {
  id: string
  tipo: TipoActuacion
  fecha: string
  titulo: string
  detalle: string | null
  visibleCliente: boolean
  etapaClave: string | null
  autorNombre: string | null
  creadoEl: string
}

export interface DocumentoDelExpediente {
  id: string
  tipo: TipoDocumento
  nombre: string
  rutaStorage: string
  tamanoBytes: number | null
  version: number
  acuseDeId: string | null
  visibleCliente: boolean
  notas: string | null
  autorNombre: string | null
  creadoEl: string
}

/** Tope por expediente. Un asunto de años no pasa de unos cientos. */
const TOPE = 500

export async function bitacoraDelExpediente(
  expedienteId: string,
): Promise<ActuacionEnBitacora[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('actuaciones')
    .select(
      'id, tipo, fecha, titulo, detalle, visible_cliente, etapa_clave, creado_el, creado_por, perfiles:creado_por(nombre)',
    )
    // Por fecha del HECHO, no de captura: es el orden en que ocurrió el asunto.
    // El desempate por captura mantiene estable lo que cayó el mismo día.
    .eq('expediente_id', expedienteId)
    .order('fecha', { ascending: false })
    .order('creado_el', { ascending: false })
    .limit(TOPE)

  return (data ?? []).map((a) => {
    const perfil = Array.isArray(a.perfiles) ? a.perfiles[0] : a.perfiles
    return {
      id: a.id,
      tipo: a.tipo,
      fecha: a.fecha,
      titulo: a.titulo,
      detalle: a.detalle,
      visibleCliente: a.visible_cliente,
      etapaClave: a.etapa_clave,
      autorNombre: perfil?.nombre ?? null,
      creadoEl: a.creado_el,
    }
  })
}

export async function documentosDelExpediente(
  expedienteId: string,
): Promise<DocumentoDelExpediente[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('documentos')
    .select(
      'id, tipo, nombre, ruta_storage, tamano_bytes, version, acuse_de_id, visible_cliente, notas, creado_el, subido_por, perfiles:subido_por(nombre)',
    )
    .eq('expediente_id', expedienteId)
    .order('creado_el', { ascending: false })
    .limit(TOPE)

  return (data ?? []).map((d) => {
    const perfil = Array.isArray(d.perfiles) ? d.perfiles[0] : d.perfiles
    return {
      id: d.id,
      tipo: d.tipo,
      nombre: d.nombre,
      rutaStorage: d.ruta_storage,
      tamanoBytes: d.tamano_bytes,
      version: d.version,
      acuseDeId: d.acuse_de_id,
      visibleCliente: d.visible_cliente,
      notas: d.notas,
      autorNombre: perfil?.nombre ?? null,
      creadoEl: d.creado_el,
    }
  })
}

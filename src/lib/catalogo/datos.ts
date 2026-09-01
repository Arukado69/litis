import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'

import type { EntradaDelCatalogo } from './verificacion'

/**
 * Consultas del catálogo.
 *
 * La RLS de `plazos_catalogo` ya decide qué se ve: las compartidas
 * (`despacho_id is null`) las lee cualquiera con sesión, y las de un despacho
 * solo sus miembros. Escribir es de `titular` o `abogado` — declarar que un
 * plazo legal es correcto es acto de quien puede firmar, no de quien captura.
 */

export async function entradasDelRegimen(
  regimen: string,
): Promise<EntradaDelCatalogo[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('plazos_catalogo')
    .select(
      'id, despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota, verificado_por, verificado_el, verificacion_notas',
    )
    .eq('regimen', regimen)
    .order('etiqueta')

  return (data ?? []).map((p) => ({
    id: p.id,
    despachoId: p.despacho_id,
    clave: p.clave,
    regimen: p.regimen,
    etiqueta: p.etiqueta,
    dias: p.dias,
    unidad: p.unidad,
    fundamento: p.fundamento,
    nota: p.nota,
    verificadoPor: p.verificado_por,
    verificadoEl: p.verificado_el,
    verificacionNotas: p.verificacion_notas,
  }))
}

/** Los nombres de quienes firmaron, para no enseñar uuids. */
export async function nombresDeVerificadores(
  ids: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const unicos = [...new Set(ids)]
  if (unicos.length === 0) return new Map()

  const supabase = await clienteServidor()
  const { data } = await supabase
    .from('perfiles')
    .select('id, nombre, correo')
    .in('id', unicos)

  return new Map(
    (data ?? []).map((p) => [p.id, p.nombre || p.correo || 'Sin nombre']),
  )
}

/**
 * Los plazos VIVOS computados con alguna de estas entradas del catálogo.
 *
 * Es el dato que convierte una corrección en una alerta: si el plazo era de 9
 * días y no de 15, cada uno de estos tiene una fecha de vencimiento equivocada
 * y alguien tiene que revisarlos uno por uno.
 *
 * ⚠️ **Recibe varios ids a propósito.** Al adoptar una entrada de fábrica se
 * crea una copia con id nuevo, pero los plazos computados ANTES de adoptarla
 * siguen apuntando al id de la semilla. Buscar solo por el id actual dejaría
 * fuera justo a los más viejos —los que llevan más tiempo con la fecha
 * equivocada— que son los que más urge revisar.
 */
export async function plazosVivosDeEntrada(
  despachoId: string,
  catalogoIds: readonly string[],
): Promise<{ id: string; expedienteId: string; etiqueta: string; caratula: string }[]> {
  const ids = [...new Set(catalogoIds.filter(Boolean))]
  if (ids.length === 0) return []

  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('plazos')
    .select(
      'id, etiqueta, expediente_id, expedientes:expediente_id(despacho_id, caratula)',
    )
    .in('plazo_catalogo_id', ids)
    .eq('estado', 'pendiente')

  return (data ?? []).flatMap((p) => {
    const exp = Array.isArray(p.expedientes) ? p.expedientes[0] : p.expedientes
    if (!exp || exp.despacho_id !== despachoId) return []
    return [
      {
        id: p.id,
        expedienteId: p.expediente_id,
        etiqueta: p.etiqueta,
        caratula: exp.caratula,
      },
    ]
  })
}

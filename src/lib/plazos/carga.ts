import 'server-only'

import { clienteServidor } from '@/lib/supabase/server'

import type { Calendario, PeriodoInhabil } from './calendario'
import type { EntradaCatalogo } from './registro'
import type { IdRegimen } from './regimenes'

/**
 * Carga desde la base lo que el motor de plazos necesita.
 *
 * El motor es puro y no sabe de Supabase: recibe un `Calendario` ya armado.
 * Este módulo es el único puente, y por eso es el único lugar donde una fila
 * se convierte en la forma que el motor entiende.
 */

/**
 * El calendario que se usa cuando el expediente no tiene órgano capturado.
 *
 * ⚠️ Es un RECURSO, no una elección informada. Los periodos vacacionales de un
 * tribunal local no coinciden con los del Poder Judicial de la Federación, así
 * que computar con el de por omisión puede dar una fecha adelantada. El alta
 * del expediente ya advierte cuando falta el órgano, y el resultado del cómputo
 * arrastra esa advertencia.
 */
export function claveCalendarioPorOmision(regimen: IdRegimen): string {
  // Laboral se aparta del calendario judicial: la LFT recorre feriados al
  // lunes y la LOPJF los fija en su fecha.
  return regimen === 'laboral' ? 'laboral-2026' : 'pjf-2026'
}

interface FilaDia {
  desde: string
  hasta: string
  motivo: PeriodoInhabil['motivo']
  descripcion: string
  fundamento: string | null
}

function armarCalendario(
  fila: {
    id: string
    nombre: string
    vigencia_desde: string
    vigencia_hasta: string
    fin_de_semana_inhabil: boolean
  },
  dias: readonly FilaDia[],
): Calendario {
  return {
    id: fila.id,
    nombre: fila.nombre,
    vigenciaDesde: fila.vigencia_desde,
    vigenciaHasta: fila.vigencia_hasta,
    finDeSemanaInhabil: fila.fin_de_semana_inhabil,
    periodos: dias.map((d) => ({
      desde: d.desde,
      hasta: d.hasta,
      motivo: d.motivo,
      descripcion: d.descripcion,
      fundamento: d.fundamento ?? undefined,
    })),
  }
}

async function cargarPorId(id: string): Promise<Calendario | null> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('calendarios')
    .select('id, nombre, vigencia_desde, vigencia_hasta, fin_de_semana_inhabil')
    .eq('id', id)
    .maybeSingle()

  if (!data) return null

  const { data: dias } = await supabase
    .from('dias_inhabiles')
    .select('desde, hasta, motivo, descripcion, fundamento')
    .eq('calendario_id', id)
    .order('desde')

  return armarCalendario(data, dias ?? [])
}

async function cargarPorClave(clave: string): Promise<Calendario | null> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('calendarios')
    .select('id, nombre, vigencia_desde, vigencia_hasta, fin_de_semana_inhabil')
    .eq('clave', clave)
    .is('despacho_id', null)
    .maybeSingle()

  return data ? cargarPorId(data.id) : null
}

/**
 * El calendario con el que se computa este expediente.
 *
 * Manda el del órgano; si no hay órgano o no tiene calendario asignado, cae al
 * de por omisión del régimen. Devuelve también si hubo que caer, para que la
 * pantalla lo diga en vez de fingir precisión.
 */
export async function calendarioDelExpediente(args: {
  organoId: string | null
  regimen: IdRegimen
}): Promise<{ calendario: Calendario | null; esPorOmision: boolean }> {
  if (args.organoId) {
    const supabase = await clienteServidor()
    const { data } = await supabase
      .from('organos')
      .select('calendario_id')
      .eq('id', args.organoId)
      .maybeSingle()

    if (data?.calendario_id) {
      const propio = await cargarPorId(data.calendario_id)
      if (propio) return { calendario: propio, esPorOmision: false }
    }
  }

  const porOmision = await cargarPorClave(claveCalendarioPorOmision(args.regimen))
  return { calendario: porOmision, esPorOmision: true }
}

/**
 * Los plazos que se le pueden ofrecer a este expediente: los del catálogo
 * compartido más los que el despacho haya agregado, filtrados por régimen.
 *
 * Ofrecer plazos de otro régimen invita a elegir uno que no aplica, y el
 * resultado sería una fecha con apariencia de correcta.
 */
export async function catalogoDeRegimen(
  regimen: IdRegimen,
): Promise<EntradaCatalogo[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('plazos_catalogo')
    .select('id, clave, etiqueta, dias, unidad, fundamento, verificado_el')
    .eq('regimen', regimen)
    .order('etiqueta')

  return (data ?? []).map((p) => ({
    id: p.id,
    clave: p.clave,
    etiqueta: p.etiqueta,
    dias: p.dias,
    unidad: p.unidad,
    fundamento: p.fundamento,
    verificado: p.verificado_el !== null,
  }))
}

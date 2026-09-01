/**
 * La agenda: audiencias y vencimientos en el MISMO calendario (motor puro).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ JUNTOS Y NO EN DOS PANTALLAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Para quien tiene que estar en un lugar a una hora, un vencimiento y una
 * audiencia compiten por el mismo día. Separarlos en dos vistas obliga a hacer
 * el cruce de cabeza cada mañana, y ahí es donde se pierde: el jueves hay
 * audiencia a las nueve y ese mismo jueves vence una contestación.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN DÍA CON AUDIENCIA ES UN DÍA TOMADO
 * ─────────────────────────────────────────────────────────────────────────────
 * No se marca "ocupado" por tener tres pendientes: se marca por tener UNA
 * audiencia. El traslado, la espera y el desahogo se llevan la jornada, y un
 * plazo que venza ese día hay que trabajarlo antes, no ese día.
 */

import { evaluarDia, type Calendario } from '@/lib/plazos/calendario'
import { comparar, sumarDias, type FechaISO } from '@/lib/plazos/fecha'
import type { EstadoAudiencia } from '@/types/db'

export interface AudienciaEnAgenda {
  id: string
  expedienteId: string
  numeroExpediente: string
  caratula: string
  tipo: string
  fecha: FechaISO
  hora: string | null
  lugar: string | null
  estado: EstadoAudiencia
  responsableId: string | null
  responsableNombre: string | null
}

export interface VencimientoEnAgenda {
  id: string
  expedienteId: string
  numeroExpediente: string
  caratula: string
  etiqueta: string
  fecha: FechaISO
  responsableId: string | null
  responsableNombre: string | null
}

export interface DiaDeAgenda {
  fecha: FechaISO
  /** Inhábil según el calendario del órgano por omisión. */
  inhabil: boolean
  motivoInhabil: string | null
  esHoy: boolean
  audiencias: readonly AudienciaEnAgenda[]
  vencimientos: readonly VencimientoEnAgenda[]
  /**
   * Hay al menos una audiencia. El día se considera tomado: lo que venza ese
   * día se trabaja antes.
   */
  tomado: boolean
}

/**
 * Los días del horizonte, con lo que cae en cada uno.
 *
 * Se devuelven **todos** los días, incluidos los vacíos y los inhábiles: una
 * agenda que solo enseña los días con algo esconde justo el dato que se usa
 * para decidir —cuántos días de trabajo hay de aquí a allá— y hace que un
 * periodo vacacional pase desapercibido.
 */
export function armarAgenda(args: {
  audiencias: readonly AudienciaEnAgenda[]
  vencimientos: readonly VencimientoEnAgenda[]
  hoy: FechaISO
  calendario: Calendario
  /** Cuántos días naturales hacia adelante. Cuatro semanas por omisión. */
  dias?: number
}): DiaDeAgenda[] {
  const { audiencias, vencimientos, hoy, calendario, dias = 28 } = args

  const porDiaAudiencias = new Map<string, AudienciaEnAgenda[]>()
  for (const a of audiencias) {
    // Lo ya celebrado, diferido o cancelado no ocupa agenda: ocupó la suya en
    // su momento y ahora vive en la bitácora.
    if (a.estado !== 'programada') continue
    const lista = porDiaAudiencias.get(a.fecha) ?? []
    lista.push(a)
    porDiaAudiencias.set(a.fecha, lista)
  }

  const porDiaVencimientos = new Map<string, VencimientoEnAgenda[]>()
  for (const v of vencimientos) {
    const lista = porDiaVencimientos.get(v.fecha) ?? []
    lista.push(v)
    porDiaVencimientos.set(v.fecha, lista)
  }

  const salida: DiaDeAgenda[] = []
  let cursor = hoy

  for (let i = 0; i < dias; i += 1) {
    const evaluado = evaluarDia(cursor, calendario)
    const delDia = porDiaAudiencias.get(cursor) ?? []

    salida.push({
      fecha: cursor,
      inhabil: evaluado.inhabil,
      motivoInhabil: evaluado.descripcion,
      esHoy: comparar(cursor, hoy) === 0,
      audiencias: ordenarPorHora(delDia),
      vencimientos: porDiaVencimientos.get(cursor) ?? [],
      tomado: delDia.length > 0,
    })

    cursor = sumarDias(cursor, 1)
  }

  return salida
}

/** Las de hora conocida primero y en orden; las sin hora, al final. */
function ordenarPorHora(
  audiencias: readonly AudienciaEnAgenda[],
): AudienciaEnAgenda[] {
  return [...audiencias].sort((a, b) => {
    if (a.hora === b.hora) return 0
    // Sin hora al final: no se sabe cuándo, así que no se puede intercalar.
    if (!a.hora) return 1
    if (!b.hora) return -1
    return a.hora.localeCompare(b.hora)
  })
}

export interface DiaCargado {
  fecha: FechaISO
  responsableNombre: string
  /** Cuántas audiencias tiene esa persona ese día. */
  audiencias: number
  vencimientos: number
}

/**
 * Los días imposibles: la misma persona con dos audiencias, o con una audiencia
 * y además un vencimiento.
 *
 * Es lo que arruina una semana, y solo sirve descubrirlo con tiempo — cuando
 * todavía se puede pedir una prórroga o mandar a alguien más. Por eso va arriba
 * de la agenda y no escondido en el día.
 */
export function diasImposibles(dias: readonly DiaDeAgenda[]): DiaCargado[] {
  const cargados: DiaCargado[] = []

  for (const dia of dias) {
    const porPersona = new Map<string, { nombre: string; a: number; v: number }>()

    for (const a of dia.audiencias) {
      if (!a.responsableId) continue
      const x = porPersona.get(a.responsableId) ?? {
        nombre: a.responsableNombre ?? 'Sin nombre',
        a: 0,
        v: 0,
      }
      x.a += 1
      porPersona.set(a.responsableId, x)
    }
    for (const v of dia.vencimientos) {
      if (!v.responsableId) continue
      const x = porPersona.get(v.responsableId)
      // Solo cuenta si esa persona YA tiene audiencia ese día: un vencimiento
      // solo no es un problema de agenda, es trabajo normal.
      if (!x) continue
      x.v += 1
    }

    for (const [, x] of porPersona) {
      if (x.a > 1 || (x.a >= 1 && x.v > 0)) {
        cargados.push({
          fecha: dia.fecha,
          responsableNombre: x.nombre,
          audiencias: x.a,
          vencimientos: x.v,
        })
      }
    }
  }

  return cargados
}

/** Cuántos días hábiles hay en el tramo. Para el encabezado de la agenda. */
export function habilesEnAgenda(dias: readonly DiaDeAgenda[]): number {
  return dias.filter((d) => !d.inhabil).length
}

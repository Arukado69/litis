/**
 * "Qué vence" — el panel de arranque (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTA VISTA Y NO UN TABLERO
 * ─────────────────────────────────────────────────────────────────────────────
 * Un Kanban contesta "en qué etapa está cada asunto". La pregunta con la que un
 * litigante abre la computadora es otra: **"¿qué se me vence?"**. Son vistas
 * distintas y la segunda es la que evita el daño.
 *
 * Por eso plazos y audiencias van en la MISMA lista. Para quien tiene que estar
 * en un lugar a una hora, un vencimiento y una audiencia compiten por el mismo
 * día; separarlos en dos pantallas obliga a hacer el cruce mentalmente, que es
 * justo donde se pierde.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOS CHOQUES DE AGENDA
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo que arruina una semana no es un plazo apretado: es descubrir el lunes que
 * el jueves hay audiencia a las nueve y ese mismo día vence una contestación.
 * Una audiencia no se mueve y consume el día. Este motor cruza compromisos por
 * persona y por día y los marca ANTES, que es cuando todavía se puede pedir una
 * prórroga o mandar a alguien más.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TODO SE CUENTA EN DÍAS HÁBILES, Y CADA UNO CON SU CALENDARIO
 * ─────────────────────────────────────────────────────────────────────────────
 * "Faltan 3 días" no dice nada si dos son sábado y domingo. Ver
 * `src/lib/plazos/alertas.ts`.
 *
 * Y no basta un calendario para todo el panel: un despacho con asuntos
 * federales y locales tiene por lo menos dos, con periodos vacacionales
 * distintos. Contar el portafolio entero con uno solo diría "faltan 5" donde
 * faltan 2 — justo en el dato que decide qué se trabaja hoy. Por eso cada
 * pendiente trae el id del calendario con el que se computó, y aquí se busca.
 */

import { diasHabilesRestantes } from '@/lib/plazos/alertas'
import type { Calendario } from '@/lib/plazos/calendario'
import { comparar, type FechaISO } from '@/lib/plazos/fecha'

export type TipoPendiente = 'plazo' | 'audiencia'

export type Urgencia = 'vencido' | 'hoy' | 'inminente' | 'proximo'

export const URGENCIA_META: Record<
  Urgencia,
  { etiqueta: string; orden: number }
> = {
  vencido: { etiqueta: 'Vencido', orden: 0 },
  hoy: { etiqueta: 'Hoy', orden: 1 },
  inminente: { etiqueta: 'Inminente', orden: 2 },
  proximo: { etiqueta: 'Próximo', orden: 3 },
}

/** Un plazo corriendo, tal como lo entrega la consulta. */
export interface PlazoDelPanel {
  id: string
  /** Con cuál se computó. `null` cae al de por omisión. */
  calendarioId: string | null
  expedienteId: string
  numeroInterno: string
  caratula: string
  etiqueta: string
  /** Siempre la efectiva: la ajustada a mano si la hay. */
  fechaVencimiento: FechaISO
  responsableId: string | null
  responsableNombre: string | null
  /** Se propaga a la tarjeta para no esconder que el cómputo no está verificado. */
  confiabilidad: 'semilla_no_verificada' | 'verificado_por_despacho'
}

export interface AudienciaDelPanel {
  id: string
  /**
   * El del órgano del expediente. Suele venir `null`: para una audiencia, la
   * fecha es exacta y los días hábiles restantes son solo una referencia, así
   * que caer al de por omisión no compromete nada.
   */
  calendarioId: string | null
  expedienteId: string
  numeroInterno: string
  caratula: string
  tipo: string
  fecha: FechaISO
  hora: string | null
  lugar: string | null
  responsableId: string | null
  responsableNombre: string | null
}

export interface Pendiente {
  tipo: TipoPendiente
  id: string
  expedienteId: string
  numeroInterno: string
  caratula: string
  /** "Contestación de demanda" o "Audiencia preliminar". */
  titulo: string
  fecha: FechaISO
  hora: string | null
  lugar: string | null
  responsableId: string | null
  responsableNombre: string | null
  diasHabiles: number
  urgencia: Urgencia
  confiabilidad: 'semilla_no_verificada' | 'verificado_por_despacho' | null
}

export interface ChoqueDeAgenda {
  fecha: FechaISO
  responsableId: string
  responsableNombre: string
  compromisos: readonly Pendiente[]
  /**
   * Hay una audiencia de por medio. Es el caso grave: no se puede mover y
   * ocupa el día completo entre traslado, espera y desahogo.
   */
  conAudiencia: boolean
}

export interface Panel {
  /** Todo lo del horizonte, ordenado de más urgente a menos. */
  pendientes: readonly Pendiente[]
  vencidos: readonly Pendiente[]
  hoy: readonly Pendiente[]
  inminentes: readonly Pendiente[]
  proximos: readonly Pendiente[]
  /**
   * Lo que no tiene a quién avisarle. Va aparte porque es lo más peligroso de
   * la lista: nadie lo está viendo y por eso nadie lo va a reclamar.
   */
  sinResponsable: readonly Pendiente[]
  choques: readonly ChoqueDeAgenda[]
}

/** Clasificación por días hábiles restantes. */
export function urgenciaPara(diasHabiles: number): Urgencia {
  if (diasHabiles < 0) return 'vencido'
  if (diasHabiles === 0) return 'hoy'
  if (diasHabiles <= 2) return 'inminente'
  return 'proximo'
}

/**
 * Arma el panel.
 *
 * @param horizonteDias hasta cuántos días hábiles hacia adelante mirar. Diez es
 *   una quincena laboral: más allá, la lista deja de ser una lista de trabajo y
 *   se vuelve un inventario que nadie lee. Lo vencido entra siempre, sin
 *   importar cuánto haga.
 */
export function armarPanel(args: {
  plazos: readonly PlazoDelPanel[]
  audiencias: readonly AudienciaDelPanel[]
  hoy: FechaISO
  /** Por id. Lo que no esté aquí cae a `calendarioPorOmision`. */
  calendarios?: ReadonlyMap<string, Calendario>
  calendarioPorOmision: Calendario
  horizonteDias?: number
}): Panel {
  const {
    plazos,
    audiencias,
    hoy,
    calendarios,
    calendarioPorOmision,
    horizonteDias = 10,
  } = args

  const calendarioDe = (id: string | null): Calendario =>
    (id ? calendarios?.get(id) : undefined) ?? calendarioPorOmision

  const pendientes: Pendiente[] = []

  for (const plazo of plazos) {
    const diasHabiles = diasHabilesRestantes(
      hoy,
      plazo.fechaVencimiento,
      calendarioDe(plazo.calendarioId),
    )
    if (diasHabiles > horizonteDias) continue

    pendientes.push({
      tipo: 'plazo',
      id: plazo.id,
      expedienteId: plazo.expedienteId,
      numeroInterno: plazo.numeroInterno,
      caratula: plazo.caratula,
      titulo: plazo.etiqueta,
      fecha: plazo.fechaVencimiento,
      hora: null,
      lugar: null,
      responsableId: plazo.responsableId,
      responsableNombre: plazo.responsableNombre,
      diasHabiles,
      urgencia: urgenciaPara(diasHabiles),
      confiabilidad: plazo.confiabilidad,
    })
  }

  for (const audiencia of audiencias) {
    const diasHabiles = diasHabilesRestantes(
      hoy,
      audiencia.fecha,
      calendarioDe(audiencia.calendarioId),
    )
    if (diasHabiles > horizonteDias) continue

    pendientes.push({
      tipo: 'audiencia',
      id: audiencia.id,
      expedienteId: audiencia.expedienteId,
      numeroInterno: audiencia.numeroInterno,
      caratula: audiencia.caratula,
      titulo: audiencia.tipo,
      fecha: audiencia.fecha,
      hora: audiencia.hora,
      lugar: audiencia.lugar,
      responsableId: audiencia.responsableId,
      responsableNombre: audiencia.responsableNombre,
      diasHabiles,
      urgencia: urgenciaPara(diasHabiles),
      confiabilidad: null,
    })
  }

  pendientes.sort(ordenarPendientes)

  return {
    pendientes,
    vencidos: pendientes.filter((p) => p.urgencia === 'vencido'),
    hoy: pendientes.filter((p) => p.urgencia === 'hoy'),
    inminentes: pendientes.filter((p) => p.urgencia === 'inminente'),
    proximos: pendientes.filter((p) => p.urgencia === 'proximo'),
    sinResponsable: pendientes.filter((p) => p.responsableId === null),
    choques: detectarChoques(pendientes),
  }
}

/**
 * Más urgente primero. A igual urgencia gana la audiencia, porque tiene hora
 * fija y no se mueve; el plazo al menos se puede trabajar de madrugada.
 */
function ordenarPendientes(a: Pendiente, b: Pendiente): number {
  if (a.diasHabiles !== b.diasHabiles) return a.diasHabiles - b.diasHabiles
  if (a.tipo !== b.tipo) return a.tipo === 'audiencia' ? -1 : 1
  return a.caratula.localeCompare(b.caratula, 'es')
}

/**
 * Días en que una misma persona tiene más de un compromiso.
 *
 * Solo mira de hoy en adelante: avisar de un choque de la semana pasada no
 * sirve para nada y ensucia la lista. Lo sin responsable no se cruza — no se
 * le puede achacar a nadie.
 */
export function detectarChoques(
  pendientes: readonly Pendiente[],
): ChoqueDeAgenda[] {
  const porPersonaYDia = new Map<string, Pendiente[]>()

  for (const p of pendientes) {
    if (p.responsableId === null) continue
    if (p.diasHabiles < 0) continue

    const clave = `${p.responsableId}::${p.fecha}`
    const grupo = porPersonaYDia.get(clave)
    if (grupo) grupo.push(p)
    else porPersonaYDia.set(clave, [p])
  }

  const choques: ChoqueDeAgenda[] = []

  for (const compromisos of porPersonaYDia.values()) {
    if (compromisos.length < 2) continue
    const primero = compromisos[0]
    if (!primero?.responsableId) continue

    choques.push({
      fecha: primero.fecha,
      responsableId: primero.responsableId,
      responsableNombre: primero.responsableNombre ?? 'Sin nombre',
      compromisos,
      conAudiencia: compromisos.some((c) => c.tipo === 'audiencia'),
    })
  }

  // Los graves primero, y dentro de esos, los más cercanos.
  return choques.sort(
    (a, b) =>
      Number(b.conAudiencia) - Number(a.conAudiencia) ||
      comparar(a.fecha, b.fecha),
  )
}

/**
 * Lo que el cliente lee (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE TRADUCE LA FASE, NO LA ETAPA
 * ─────────────────────────────────────────────────────────────────────────────
 * "Citación para sentencia" no le dice nada a quien no es abogado, y peor:
 * suena a que ya se resolvió. Traducir etapa por etapa serían treinta y ocho
 * frases que se desincronizan del catálogo a la primera reforma.
 *
 * Se traducen las **seis fases universales** del tablero (`lib/tablero/fases`),
 * que ya son vía-agnósticas y ya están probadas contra todo el catálogo. Un
 * cliente no necesita saber si va en ofrecimiento o en desahogo de pruebas:
 * necesita saber que el juicio está en la etapa de pruebas y que eso es la
 * parte larga.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ AQUÍ NO SE PROMETE NADA
 * ─────────────────────────────────────────────────────────────────────────────
 * Ni fechas de terminación, ni "ya falta poco", ni pronósticos del resultado.
 * Un litigante no puede saber cuándo termina un juicio —depende del juzgado, de
 * la contraparte y de si hay amparo— y un portal que insinúe una fecha convierte
 * una expectativa del sistema en una promesa del abogado.
 *
 * Lo que sí se dice es **cuándo se movió por última vez**, porque la pregunta
 * real detrás del "¿cómo va lo mío?" casi nunca es "¿cuándo termina?" sino
 * "¿siguen trabajando en esto?".
 */

import { faseDeEtapa, type IdFase } from '@/lib/tablero/fases'

export interface FaseEnLlano {
  /** Cómo se llama para el cliente. Sin tecnicismos. */
  titulo: string
  /** Qué está pasando, en una frase que se entienda sin haber estudiado. */
  queSignifica: string
  /** Qué sigue. Sin fechas y sin promesas. */
  queSigue: string
}

export const FASE_EN_LLANO: Record<IdFase, FaseEnLlano> = {
  preparacion: {
    titulo: 'Preparando el asunto',
    queSignifica:
      'Todavía no se presenta nada ante el juzgado. Se está reuniendo la documentación y armando el escrito.',
    queSigue: 'Cuando el expediente esté completo, se presenta la demanda.',
  },
  presentacion: {
    titulo: 'Presentado ante el juzgado',
    queSignifica:
      'El escrito ya se presentó. El juzgado tiene que revisarlo y decidir si lo admite.',
    queSigue:
      'Si lo admite, se notifica a la otra parte para que conteste. Los tiempos del juzgado no dependen del despacho.',
  },
  instruccion: {
    titulo: 'En trámite ante el juzgado',
    queSignifica:
      'Es la parte larga del juicio: cada parte expone lo suyo y se ofrecen y desahogan las pruebas. Suele haber audiencias.',
    queSigue:
      'Cuando termine de desahogarse todo, el juzgado cierra esta etapa y pasa a resolver.',
  },
  resolucion: {
    titulo: 'Por resolverse',
    queSignifica:
      'Ya se dijo y se probó todo lo que había que decir. El asunto está con el juez para que dicte sentencia.',
    queSigue:
      'La sentencia llega cuando el juzgado la emite. No hay forma de saber la fecha con anticipación.',
  },
  impugnacion: {
    titulo: 'En revisión de un tribunal superior',
    queSignifica:
      'Ya hubo una resolución y se está combatiendo ante una instancia superior — por nuestra parte o por la contraria.',
    queSigue: 'El tribunal superior revisa y confirma, modifica o revoca lo resuelto.',
  },
  ejecucion: {
    titulo: 'Haciendo cumplir lo resuelto',
    queSignifica:
      'El juicio ya se resolvió y ahora se trabaja en que lo decidido se cumpla de verdad.',
    queSigue: 'El asunto termina cuando se cumpla por completo.',
  },
}

/** Cuando no hay etapa capturada, se dice — no se inventa una. */
export const SIN_ETAPA: FaseEnLlano = {
  titulo: 'En seguimiento',
  queSignifica: 'Tu abogado está al pendiente de este asunto.',
  queSigue: 'En cuanto haya un movimiento, aparece aquí.',
}

export function faseEnLlano(via: string, etapaClave: string | null): FaseEnLlano {
  const fase = faseDeEtapa(via, etapaClave)
  return fase ? FASE_EN_LLANO[fase] : SIN_ETAPA
}

/**
 * Cuánto lleva sin movimiento, en palabras.
 *
 * Es la respuesta a la pregunta que de verdad trae el cliente. Se dice el dato
 * y punto: **no se disculpa ni se justifica**. "Hace tres meses" con una
 * explicación defensiva al lado suena peor que el dato solo, y además los
 * tiempos muertos de un juicio son normales y no son culpa del despacho.
 */
export function ultimoMovimiento(fecha: string | null, hoy: string): string {
  if (!fecha) return 'Sin movimientos registrados todavía.'

  const desde = Date.parse(`${fecha.slice(0, 10)}T00:00:00Z`)
  const hasta = Date.parse(`${hoy}T00:00:00Z`)
  if (Number.isNaN(desde) || Number.isNaN(hasta)) return ''

  const dias = Math.max(0, Math.round((hasta - desde) / 86_400_000))

  if (dias === 0) return 'Último movimiento: hoy.'
  if (dias === 1) return 'Último movimiento: ayer.'
  if (dias < 7) return `Último movimiento: hace ${dias} días.`
  if (dias < 30) {
    const semanas = Math.round(dias / 7)
    return `Último movimiento: hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}.`
  }
  const meses = Math.round(dias / 30)
  return `Último movimiento: hace ${meses} ${meses === 1 ? 'mes' : 'meses'}.`
}

/**
 * El aviso al pie del portal.
 *
 * Dice **por qué** no está todo, en vez de dejar que el cliente suponga que se
 * le esconde algo. La razón es real: los términos procesales son información
 * que no se puede interpretar sin haber estudiado, y verlos solo produce
 * angustia sobre algo que no está en sus manos.
 */
export const AVISO_PORTAL =
  'Aquí ves el avance de tu asunto, tus audiencias y los documentos que tu abogado compartió contigo. Los términos procesales y las notas internas del despacho no aparecen: son herramientas de trabajo que no se pueden interpretar sin contexto legal. Si algo no te queda claro, escríbele a tu abogado.'

/**
 * Alertas de vencimiento de plazos (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SE CUENTA EN DÍAS HÁBILES Y NO NATURALES
 * ─────────────────────────────────────────────────────────────────────────────
 * "Faltan 3 días" no significa nada para quien tiene que redactar, imprimir,
 * firmar y presentar. Si esos tres días son viernes, sábado y domingo, en
 * realidad falta UN día de trabajo. Un aviso en días naturales avisa tarde
 * justo en el peor escenario: los puentes y los periodos vacacionales, que es
 * cuando la gente se confía. Por eso el conteo corre sobre el mismo calendario
 * con el que se computó el plazo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ SON VENTANAS Y NO DÍAS EXACTOS
 * ─────────────────────────────────────────────────────────────────────────────
 * Si el aviso de "faltan 3" solo se dispara cuando faltan exactamente 3, un
 * cron que no corrió ese día pierde el aviso para siempre. Las ventanas hacen
 * que la siguiente corrida lo alcance. Es la misma disciplina que se usa para
 * cualquier recordatorio que no se puede dar el lujo de perderse.
 *
 * La idempotencia va por fuera: cada nivel se manda UNA vez por plazo, y el
 * registro de lo enviado entra como parámetro (`yaEnviados`). La red final es
 * un índice único en la base.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CADA PLAZO SE CUENTA CON SU PROPIO CALENDARIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Un despacho con asuntos federales y locales tiene por lo menos dos, con
 * periodos vacacionales distintos. Contar el portafolio entero con uno solo
 * manda el aviso de "faltan 3" cuando en realidad falta 1 — y ese error, en la
 * pieza que existe para que nadie pierda un término, es el único que no se
 * puede permitir.
 */

import { evaluarDia, type Calendario } from './calendario'
import { comparar, sumarDias, type FechaISO } from './fecha'

export type NivelAlerta =
  | 't_menos_5'
  | 't_menos_3'
  | 't_menos_1'
  | 'vence_hoy'
  | 'vencido'

export const NIVEL_META: Record<
  NivelAlerta,
  { etiqueta: string; urgencia: 'baja' | 'media' | 'alta' | 'critica'; intencion: string }
> = {
  t_menos_5: {
    etiqueta: 'Faltan 5 días hábiles',
    urgencia: 'baja',
    intencion: 'Hay margen para preparar sin prisa y pedir lo que falte al cliente.',
  },
  t_menos_3: {
    etiqueta: 'Faltan 3 días hábiles',
    urgencia: 'media',
    intencion: 'Momento de tener el borrador listo.',
  },
  t_menos_1: {
    etiqueta: 'Vence mañana',
    urgencia: 'alta',
    intencion: 'Última jornada completa para firmar y presentar.',
  },
  vence_hoy: {
    etiqueta: 'Vence hoy',
    urgencia: 'critica',
    intencion: 'Se presenta hoy o se pierde el término.',
  },
  vencido: {
    etiqueta: 'Vencido sin registrar presentación',
    urgencia: 'critica',
    intencion:
      'El plazo pasó y nadie marcó la promoción como presentada. Verifica de inmediato: si se presentó, actualízalo; si no, esto ya es un asunto de responsabilidad.',
  },
}

/**
 * Ventanas en días hábiles restantes, cerradas por ambos extremos.
 * `vencido` se deja abierto hacia atrás para que se dispare aunque el aviso
 * lleve días sin correr.
 */
export const VENTANAS: Record<NivelAlerta, { desde: number; hasta: number }> = {
  t_menos_5: { desde: 4, hasta: 5 },
  t_menos_3: { desde: 2, hasta: 3 },
  t_menos_1: { desde: 1, hasta: 1 },
  vence_hoy: { desde: 0, hasta: 0 },
  vencido: { desde: Number.NEGATIVE_INFINITY, hasta: -1 },
}

/** Del más urgente al menos urgente. Si dos ventanas se traslaparan, gana este orden. */
const ORDEN_URGENCIA: readonly NivelAlerta[] = [
  'vencido',
  'vence_hoy',
  't_menos_1',
  't_menos_3',
  't_menos_5',
]

/** Tope de recorrido, para que un calendario mal capturado no cuelgue el proceso. */
const TOPE_DIAS = 400

/**
 * Días hábiles entre `hoy` (exclusivo) y `vencimiento` (inclusivo).
 *
 *   · 0  → vence hoy
 *   · 1  → vence el siguiente día hábil
 *   · <0 → ya venció; el valor absoluto son los hábiles transcurridos desde
 *          el vencimiento (exclusivo) hasta hoy (inclusive).
 */
export function diasHabilesRestantes(
  hoy: FechaISO,
  vencimiento: FechaISO,
  calendario: Calendario,
): number {
  const orden = comparar(hoy, vencimiento)
  if (orden === 0) return 0

  const haciaAdelante = orden < 0
  const [desde, hasta] = haciaAdelante ? [hoy, vencimiento] : [vencimiento, hoy]

  let contados = 0
  let cursor = sumarDias(desde, 1)
  let recorridos = 0

  while (comparar(cursor, hasta) <= 0) {
    if (recorridos++ > TOPE_DIAS) {
      throw new Error(
        `No se pudo contar los días hábiles entre ${desde} y ${hasta}: el tramo excede ${TOPE_DIAS} días.`,
      )
    }
    if (!evaluarDia(cursor, calendario).inhabil) contados++
    cursor = sumarDias(cursor, 1)
  }

  return haciaAdelante ? contados : -contados
}

/** Qué nivel corresponde a esos días restantes. `null` si ninguno. */
export function nivelPara(diasRestantes: number): NivelAlerta | null {
  for (const nivel of ORDEN_URGENCIA) {
    const v = VENTANAS[nivel]
    if (diasRestantes >= v.desde && diasRestantes <= v.hasta) return nivel
  }
  return null
}

export interface PlazoVigilado {
  plazoId: string
  expedienteId: string
  /** Con cuál se computó. `null` cae al de por omisión. */
  calendarioId: string | null
  /** "431/2026" o el interno: para reconocer el asunto sin abrir nada. */
  numeroExpediente: string
  /** "Pérez vs. Constructora XYZ" — para que el aviso se entienda sin abrir nada. */
  caratula: string
  /** "Contestación de demanda" */
  etiqueta: string
  fechaVencimiento: FechaISO
  /** Quién responde por este plazo. */
  responsableId: string | null
  responsableNombre: string | null
  responsableEmail: string | null
  /**
   * Ya se presentó la promoción. Un plazo atendido no genera alertas: llenar
   * de avisos lo que ya está hecho enseña a ignorar los avisos.
   */
  atendido: boolean
}

export interface AlertaPendiente {
  nivel: NivelAlerta
  plazo: PlazoVigilado
  diasRestantes: number
}

/** Clave estable del registro de envíos: un nivel por plazo, una sola vez. */
export function claveAlerta(plazoId: string, nivel: NivelAlerta): string {
  return `${plazoId}:${nivel}`
}

/**
 * Decide qué alertas toca mandar hoy.
 *
 * @param yaEnviados claves `${plazoId}:${nivel}` que ya salieron.
 */
export function calcularAlertas(args: {
  plazos: readonly PlazoVigilado[]
  yaEnviados: ReadonlySet<string>
  hoy: FechaISO
  /** Por id. Lo que no esté aquí cae a `calendarioPorOmision`. */
  calendarios?: ReadonlyMap<string, Calendario>
  calendarioPorOmision: Calendario
}): AlertaPendiente[] {
  const pendientes: AlertaPendiente[] = []

  const calendarioDe = (id: string | null): Calendario =>
    (id ? args.calendarios?.get(id) : undefined) ?? args.calendarioPorOmision

  for (const plazo of args.plazos) {
    if (plazo.atendido) continue

    const diasRestantes = diasHabilesRestantes(
      args.hoy,
      plazo.fechaVencimiento,
      calendarioDe(plazo.calendarioId),
    )
    const nivel = nivelPara(diasRestantes)
    if (!nivel) continue
    if (args.yaEnviados.has(claveAlerta(plazo.plazoId, nivel))) continue

    pendientes.push({ nivel, plazo, diasRestantes })
  }

  // Lo más urgente primero: si el envío se corta a la mitad, que hayan salido
  // los que no pueden esperar.
  return pendientes.sort((a, b) => a.diasRestantes - b.diasRestantes)
}

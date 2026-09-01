/**
 * A quién le llega cada alerta, y en cuántos correos (motor puro).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN CORREO POR PERSONA, NO UNO POR PLAZO
 * ─────────────────────────────────────────────────────────────────────────────
 * Un litigante con cinco términos apretados recibiría cinco correos idénticos
 * en el mismo minuto. Al tercer día los archiva sin abrirlos, y el día que
 * llegue el que sí importaba también lo va a archivar sin abrirlo.
 *
 * Así que se agrupa: un correo por persona, con todo lo suyo ordenado de más
 * urgente a menos. Lo que se gana no es cortesía, es que el correo se siga
 * abriendo dentro de seis meses.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE NO TIENE RESPONSABLE VA AL TITULAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Un plazo sin responsable es el más peligroso de todos: nadie lo está viendo,
 * así que nadie lo va a reclamar. Dejarlo sin destinatario sería avisar de todo
 * menos de lo único que ya está fallando. Va al titular, marcado como huérfano.
 */

import type { AlertaPendiente, NivelAlerta } from '@/lib/plazos/alertas'

export interface Destinatario {
  perfilId: string | null
  nombre: string
  correo: string
}

export interface Lote {
  destinatario: Destinatario
  /** Ordenadas de más urgente a menos. */
  alertas: readonly AlertaPendiente[]
  /**
   * Ninguna de estas alertas tiene responsable: le llegan al titular porque
   * nadie más las está viendo.
   */
  huerfanas: boolean
}

/** El nivel más urgente del lote. Decide el asunto del correo. */
const ORDEN: readonly NivelAlerta[] = [
  'vencido',
  'vence_hoy',
  't_menos_1',
  't_menos_3',
  't_menos_5',
]

export function nivelMasUrgente(
  alertas: readonly AlertaPendiente[],
): NivelAlerta | null {
  for (const nivel of ORDEN) {
    if (alertas.some((a) => a.nivel === nivel)) return nivel
  }
  return null
}

/**
 * Reparte las alertas en lotes, uno por destinatario.
 *
 * @param titular a quién le llega lo que no tiene responsable. Si no hay
 *   titular con correo, esas alertas se devuelven en `sinDestinatario` en vez
 *   de perderse en silencio: la corrida tiene que poder decir que hubo términos
 *   de los que no pudo avisarle a nadie.
 */
export function repartir(args: {
  alertas: readonly AlertaPendiente[]
  titular: Destinatario | null
}): { lotes: Lote[]; sinDestinatario: AlertaPendiente[] } {
  const porPersona = new Map<string, { d: Destinatario; alertas: AlertaPendiente[] }>()
  const huerfanas: AlertaPendiente[] = []
  const sinDestinatario: AlertaPendiente[] = []

  for (const alerta of args.alertas) {
    const { responsableId, responsableNombre, responsableEmail } = alerta.plazo

    if (!responsableId || !responsableEmail) {
      huerfanas.push(alerta)
      continue
    }

    const actual = porPersona.get(responsableId)
    if (actual) {
      actual.alertas.push(alerta)
    } else {
      porPersona.set(responsableId, {
        d: {
          perfilId: responsableId,
          nombre: responsableNombre ?? responsableEmail,
          correo: responsableEmail,
        },
        alertas: [alerta],
      })
    }
  }

  const lotes: Lote[] = [...porPersona.values()].map((x) => ({
    destinatario: x.d,
    alertas: ordenar(x.alertas),
    huerfanas: false,
  }))

  if (huerfanas.length > 0) {
    if (args.titular?.correo) {
      lotes.push({
        destinatario: args.titular,
        alertas: ordenar(huerfanas),
        huerfanas: true,
      })
    } else {
      sinDestinatario.push(...huerfanas)
    }
  }

  return { lotes, sinDestinatario }
}

/** De más urgente a menos. Los vencidos primero, con el más viejo al frente. */
function ordenar(alertas: AlertaPendiente[]): AlertaPendiente[] {
  return [...alertas].sort((a, b) => a.diasRestantes - b.diasRestantes)
}

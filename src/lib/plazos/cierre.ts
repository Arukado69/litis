/**
 * Cierre de un plazo (motor puro, sin efectos).
 *
 * Un plazo sale de la vigilancia por dos caminos, y solo dos:
 *
 *   · **presentada** — se presentó la promoción. Es el cierre normal.
 *   · **cancelada**  — el plazo dejó de aplicar: hubo desistimiento, se
 *     acumuló el asunto, quedó sin materia. No se presentó nada y tampoco se
 *     perdió nada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA PRESENTACIÓN EXTEMPORÁNEA NO SE MAQUILLA
 * ─────────────────────────────────────────────────────────────────────────────
 * Si el plazo vencía el 16 y la promoción se presentó el 18, marcarlo
 * "atendido" y ya dejaría el panel en verde y el expediente diciendo que todo
 * salió bien. No salió bien: **se perdió el término**, con todo lo que eso
 * implica frente al cliente.
 *
 * Un sistema que ayuda a tapar eso es peor que no tener sistema, porque
 * fabrica un registro tranquilizador sobre un hecho grave. Así que la
 * extemporaneidad se detecta, se advierte ANTES de guardar, se exige que
 * alguien la reconozca de forma expresa y queda escrita en la bitácora —que es
 * inmutable— con esas palabras.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CANCELAR EXIGE MOTIVO
 * ─────────────────────────────────────────────────────────────────────────────
 * Sin motivo, cancelar sería la forma cómoda de hacer desaparecer del panel
 * cualquier plazo incómodo, sin dejar rastro de por qué. Con motivo, es una
 * decisión que alguien firmó.
 */

import { esFechaISO, fechaLarga, type FechaISO } from './fecha'

export type AccionCierre = 'presentada' | 'cancelada'

export interface Problema {
  campo: string
  mensaje: string
}

export interface CapturaCierre {
  accion: AccionCierre
  /** Solo en `presentada`. */
  fechaPresentacion: FechaISO | null
  /** Qué se presentó. Va a la bitácora. */
  descripcion: string | null
  /** Solo en `cancelada`. Obligatorio. */
  motivo: string | null
  /** Reconocimiento expreso de que se presentó fuera de plazo. */
  reconoceExtemporanea: boolean
}

/** Los datos del plazo que se está cerrando. El motor no los adivina. */
export interface ContextoCierre {
  hoy: FechaISO
  /** La EFECTIVA: la ajustada a mano si la hubo. */
  fechaVencimiento: FechaISO
  fechaNotificacion: FechaISO
}

function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

export function leerCierre(campos: Record<string, string>): CapturaCierre {
  const fecha = campos.fechaPresentacion?.trim()
  return {
    accion: campos.accion === 'cancelada' ? 'cancelada' : 'presentada',
    fechaPresentacion: esFechaISO(fecha) ? fecha : null,
    descripcion: texto(campos, 'descripcion'),
    motivo: texto(campos, 'motivo'),
    reconoceExtemporanea: campos.reconoceExtemporanea === 'on',
  }
}

/**
 * ¿Se presentó después del vencimiento?
 *
 * Se compara contra la fecha EFECTIVA —la ajustada a mano si la hubo—, porque
 * esa es la que el despacho tenía por buena. Las dos son `yyyy-mm-dd`, así que
 * la comparación de texto es la comparación de fechas.
 */
export function esExtemporanea(
  fechaPresentacion: FechaISO,
  fechaVencimiento: FechaISO,
): boolean {
  return fechaPresentacion > fechaVencimiento
}

/** Mínimo de un motivo de cancelación que signifique algo. */
const LARGO_MIN_MOTIVO = 10

export function validarCierre(
  captura: CapturaCierre,
  contexto: ContextoCierre,
): Problema[] {
  const problemas: Problema[] = []

  if (captura.accion === 'cancelada') {
    if (!captura.motivo || captura.motivo.length < LARGO_MIN_MOTIVO) {
      problemas.push({
        campo: 'motivo',
        mensaje:
          'Explica por qué el plazo dejó de aplicar. Sin motivo, cancelar sería hacerlo desaparecer sin rastro.',
      })
    }
    return problemas
  }

  const fecha = captura.fechaPresentacion

  if (!fecha) {
    problemas.push({
      campo: 'fechaPresentacion',
      mensaje: 'Captura la fecha en que se presentó.',
    })
    return problemas
  }

  if (fecha > contexto.hoy) {
    // Marcar como presentado algo que todavía no se presenta deja el plazo
    // fuera de la vigilancia justo mientras sigue corriendo.
    problemas.push({
      campo: 'fechaPresentacion',
      mensaje: 'No puedes registrar una presentación con fecha futura.',
    })
    return problemas
  }

  if (fecha < contexto.fechaNotificacion) {
    // No es purismo: el error de captura más común es el año, y un 2025 en
    // lugar de 2026 convertiría una presentación extemporánea en una
    // anticipada, que es justo lo que no se puede dejar pasar.
    problemas.push({
      campo: 'fechaPresentacion',
      mensaje: `La promoción no pudo presentarse antes de la notificación que originó el plazo (${fechaLarga(contexto.fechaNotificacion)}). Revisa la fecha.`,
    })
    return problemas
  }

  if (
    esExtemporanea(fecha, contexto.fechaVencimiento) &&
    !captura.reconoceExtemporanea
  ) {
    problemas.push({
      campo: 'reconoceExtemporanea',
      mensaje:
        'Se presentó fuera de plazo. Marca la casilla para dejarlo asentado así en la bitácora.',
    })
  }

  return problemas
}

/**
 * El aviso que se muestra ANTES de guardar, cuando la fecha capturada cae
 * después del vencimiento. Se escribe con las dos fechas: quien captura suele
 * estar viendo el acuse, no el plazo.
 */
export function avisoExtemporaneidad(
  fechaPresentacion: FechaISO,
  fechaVencimiento: FechaISO,
): string {
  return `Según esta fecha, la promoción se presentó el ${fechaLarga(fechaPresentacion)} y el plazo venció el ${fechaLarga(fechaVencimiento)}: se presentó FUERA DE PLAZO. Si la fecha está mal, corrígela. Si está bien, así va a quedar asentado en la bitácora, que no se puede editar después.`
}

/** El título de la actuación que queda en la bitácora. */
export function tituloActuacion(
  captura: CapturaCierre,
  etiquetaPlazo: string,
  extemporanea: boolean,
): string {
  if (captura.accion === 'cancelada') {
    return `Plazo cancelado — ${etiquetaPlazo}`
  }
  return extemporanea
    ? `Presentación EXTEMPORÁNEA — ${etiquetaPlazo}`
    : `Promoción presentada — ${etiquetaPlazo}`
}

/**
 * El detalle. En la extemporánea se escriben las dos fechas y la palabra
 * completa: dentro de dos años, "presentada el 18" sin más contexto no le dice
 * nada a nadie.
 */
export function detalleActuacion(
  captura: CapturaCierre,
  fechaVencimiento: FechaISO,
  extemporanea: boolean,
): string {
  if (captura.accion === 'cancelada') {
    return `El plazo dejó de aplicar. Motivo: ${captura.motivo}`
  }

  const partes: string[] = []
  if (extemporanea && captura.fechaPresentacion) {
    partes.push(
      `Se presentó el ${fechaLarga(captura.fechaPresentacion)}, DESPUÉS del vencimiento del ${fechaLarga(fechaVencimiento)}. El término se presentó fuera de plazo.`,
    )
  }
  if (captura.descripcion) partes.push(captura.descripcion)

  return partes.join('\n\n') || 'Sin detalle.'
}

/** El tipo de actuación con el que entra a la bitácora. */
export function tipoActuacionDeCierre(
  captura: CapturaCierre,
): 'promocion' | 'nota_interna' {
  // Cancelar no es un escrito: es una decisión del despacho sobre su propia
  // vigilancia. Asentarla como `promocion` inventaría un documento que nunca
  // se presentó ante el órgano.
  return captura.accion === 'presentada' ? 'promocion' : 'nota_interna'
}

/** El estado en que queda el plazo. */
export function estadoResultante(
  captura: CapturaCierre,
): 'atendido' | 'cancelado' {
  // Incluso la extemporánea queda `atendido`: el plazo dejó de correr y sale
  // de la vigilancia. Que se haya presentado tarde no lo dice el estado —lo
  // dice la bitácora, que es donde no se puede borrar.
  return captura.accion === 'presentada' ? 'atendido' : 'cancelado'
}

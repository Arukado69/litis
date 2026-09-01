/**
 * Captura de una actuación de la bitácora (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA BITÁCORA NO SE REESCRIBE
 * ─────────────────────────────────────────────────────────────────────────────
 * `actuaciones` no tiene política de UPDATE ni de DELETE, a propósito (ver la
 * migración `0004`). Lo que se asienta, se queda. Corregir es **agregar otra
 * actuación que rectifique**, igual que en un expediente de papel se agrega una
 * foja en vez de tachar la anterior.
 *
 * Eso tiene una consecuencia que la pantalla tiene que decir en voz alta:
 * **`visible_cliente` se decide al escribir y no se puede deshacer.** Marcar
 * visible una nota interna que hablaba mal de la contraparte —o del propio
 * cliente— no se arregla después: la fila no se puede editar, y aunque se
 * pudiera, el cliente ya la vio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA FECHA ES CUÁNDO OCURRIÓ, NO CUÁNDO SE CAPTURÓ
 * ─────────────────────────────────────────────────────────────────────────────
 * Se captura el lunes lo que pasó el viernes, y eso es lo normal. Poner la
 * fecha de captura convertiría la bitácora en un registro de cuándo alguien
 * tuvo tiempo de teclear, que no le sirve a nadie.
 */

import { esFechaISO, type FechaISO } from '@/lib/plazos/fecha'
import type { TipoActuacion } from '@/types/db'

export interface Problema {
  campo: string
  mensaje: string
}

export const TIPO_ACTUACION_ETIQUETA: Record<TipoActuacion, string> = {
  promocion: 'Promoción presentada',
  acuerdo: 'Acuerdo del órgano',
  notificacion: 'Notificación recibida',
  resolucion: 'Resolución',
  audiencia: 'Audiencia',
  diligencia: 'Diligencia',
  comunicacion: 'Comunicación',
  nota_interna: 'Nota interna',
}

/** Qué es cada cosa, para quien no lo tiene en la punta de la lengua. */
export const TIPO_ACTUACION_AYUDA: Record<TipoActuacion, string> = {
  promocion: 'Un escrito que presentamos ante el órgano.',
  acuerdo: 'Un proveído del juzgado.',
  notificacion:
    'Una notificación recibida. Si dispara un plazo, regístrala desde "Registrar notificación" para que se compute.',
  resolucion: 'Sentencia, laudo o interlocutoria.',
  audiencia: 'Lo que ocurrió en una audiencia.',
  diligencia: 'Actuación del actuario fuera del local del juzgado.',
  comunicacion: 'Trato con el cliente o con la contraparte.',
  nota_interna: 'Solo para el despacho. Nunca se comparte con el cliente.',
}

const TIPOS = Object.keys(TIPO_ACTUACION_ETIQUETA) as TipoActuacion[]

/**
 * Una nota interna JAMÁS se marca visible.
 *
 * Es la única categoría cuyo nombre promete que el cliente no la va a ver, y
 * un sistema que deja romper esa promesa con una casilla mal marcada convierte
 * el campo "nota interna" en una trampa. Si algo es para el cliente, se asienta
 * como comunicación.
 */
export const NUNCA_VISIBLE: readonly TipoActuacion[] = ['nota_interna']

export interface CapturaActuacion {
  tipo: TipoActuacion
  fecha: FechaISO | null
  titulo: string
  detalle: string | null
  visibleCliente: boolean
}

function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

export function leerActuacion(
  campos: Record<string, string>,
): CapturaActuacion {
  const tipo = campos.tipo as TipoActuacion
  const fecha = campos.fecha?.trim()
  const elegido = TIPOS.includes(tipo) ? tipo : 'nota_interna'

  return {
    tipo: elegido,
    fecha: esFechaISO(fecha) ? fecha : null,
    titulo: campos.titulo?.trim() ?? '',
    detalle: texto(campos, 'detalle'),
    // Se fuerza aquí, no solo en la pantalla: ocultar la casilla no detiene a
    // quien llame la Server Action directo.
    visibleCliente: campos.visibleCliente === 'on' && !NUNCA_VISIBLE.includes(elegido),
  }
}

const LARGO_MIN_TITULO = 4

export function validarActuacion(
  captura: CapturaActuacion,
  hoy: FechaISO,
): Problema[] {
  const problemas: Problema[] = []

  if (captura.titulo.length < LARGO_MIN_TITULO) {
    problemas.push({
      campo: 'titulo',
      mensaje: 'Escribe de qué se trata. Es lo que se va a leer dentro de dos años.',
    })
  }

  if (!captura.fecha) {
    problemas.push({ campo: 'fecha', mensaje: 'Captura la fecha en que ocurrió.' })
  } else if (captura.fecha > hoy) {
    // Una actuación futura no es un hecho: es un plan, y los planes van en la
    // agenda, no en la bitácora.
    problemas.push({
      campo: 'fecha',
      mensaje: 'La bitácora registra lo que ya pasó. Para algo futuro, agenda la audiencia.',
    })
  }

  return problemas
}

/** El aviso que acompaña a la casilla de visibilidad. */
export const AVISO_VISIBILIDAD =
  'Si la marcas visible, el cliente la verá en su portal y esto NO se puede deshacer: la bitácora no se edita ni se borra.'

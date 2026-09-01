/**
 * Audiencias (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UNA AUDIENCIA NO SE MUEVE Y SE COME EL DÍA
 * ─────────────────────────────────────────────────────────────────────────────
 * Un plazo se puede trabajar de noche, en la oficina, el día antes. Una
 * audiencia es estar en un lugar a una hora, y con el traslado, la espera en el
 * pasillo y el desahogo, se lleva la jornada. Por eso en la agenda no cuenta
 * como "un pendiente más": marca el día entero como tomado, y todo lo que caiga
 * ahí hay que adelantarlo o repartirlo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DIFERIR NO ES CANCELAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuando el juzgado difiere una audiencia, la que estaba señalada **ocurrió como
 * hecho**: se fue al juzgado, se esperó, y se difirió. Borrarla o cambiarle la
 * fecha encima haría desaparecer ese día del expediente, y ese día se cobra, se
 * justifica ante el cliente y a veces explica por qué un plazo corrió distinto.
 *
 * Así que diferir deja DOS registros: la vieja marcada `diferida` con su motivo,
 * y una nueva `programada` en la fecha nueva.
 */

import { esFechaISO, type FechaISO } from '@/lib/plazos/fecha'
import type { EstadoAudiencia } from '@/types/db'

export interface Problema {
  campo: string
  mensaje: string
}

export const ESTADO_AUDIENCIA_ETIQUETA: Record<EstadoAudiencia, string> = {
  programada: 'Programada',
  celebrada: 'Celebrada',
  diferida: 'Diferida',
  cancelada: 'Cancelada',
}

/**
 * Los tipos que más se señalan, como sugerencia.
 *
 * Es una lista de ayuda, **no un catálogo cerrado**: entre las 32 entidades y
 * las materias hay nombres que no caben en ninguna lista, y un campo que no
 * deja escribir "junta de avenencia" obliga a poner "otra" y perder el dato.
 */
export const TIPOS_SUGERIDOS: readonly string[] = [
  'Audiencia preliminar',
  'Audiencia de juicio',
  'Audiencia inicial',
  'Audiencia preliminar de conciliación',
  'Desahogo de pruebas',
  'Audiencia constitucional',
  'Audiencia incidental',
  'Junta de avenencia',
  'Diligencia de embargo',
  'Remate',
  'Alegatos',
]

export interface CapturaAudiencia {
  tipo: string
  fecha: FechaISO | null
  hora: string | null
  lugar: string | null
  responsableId: string | null
  notas: string | null
  visibleCliente: boolean
}

function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

/** `HH:MM` o `HH:MM:SS`. Otra cosa se descarta en vez de adivinarse. */
export function leerHora(valor: string | undefined): string | null {
  const limpio = valor?.trim()
  if (!limpio) return null
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(limpio) ? limpio.slice(0, 5) : null
}

export function leerAudiencia(campos: Record<string, string>): CapturaAudiencia {
  const fecha = campos.fecha?.trim()
  return {
    tipo: campos.tipo?.trim() ?? '',
    fecha: esFechaISO(fecha) ? fecha : null,
    hora: leerHora(campos.hora),
    lugar: texto(campos, 'lugar'),
    responsableId: texto(campos, 'responsableId'),
    notas: texto(campos, 'notas'),
    // Al cliente le sirve saber cuándo es su audiencia: es de lo poco del
    // expediente que le toca a él. Por eso viene marcado de fábrica, al revés
    // que la bitácora.
    visibleCliente: campos.visibleCliente !== 'off',
  }
}

const LARGO_MIN_TIPO = 4

export function validarAudiencia(captura: CapturaAudiencia): Problema[] {
  const problemas: Problema[] = []

  if (captura.tipo.length < LARGO_MIN_TIPO) {
    problemas.push({ campo: 'tipo', mensaje: 'Escribe qué audiencia es.' })
  }

  // Una audiencia SÍ puede tener fecha futura: es un plan, y ese es justo el
  // punto. Lo contrario a la bitácora, que solo registra lo que ya pasó.
  if (!captura.fecha) {
    problemas.push({ campo: 'fecha', mensaje: 'Captura la fecha señalada.' })
  }

  return problemas
}

/**
 * Las advertencias que NO bloquean.
 *
 * Se señala una audiencia con lo que se sabe en ese momento: a veces el acuerdo
 * dice el día pero no la hora, o todavía no se decide quién va. Exigirlo todo
 * obligaría a anotarla en un papel aparte mientras tanto — y entonces el
 * sistema sobra.
 */
export function advertenciasDeAudiencia(
  captura: CapturaAudiencia,
): string[] {
  const avisos: string[] = []

  if (!captura.hora) {
    avisos.push(
      'Sin hora no se puede saber si alcanza a llegar de una audiencia a otra. Captúrala en cuanto la sepas.',
    )
  }
  if (!captura.responsableId) {
    // Es el aviso que más importa de esta pantalla.
    avisos.push(
      'Sin responsable, esta es una audiencia a la que no va nadie. Nada la va a reclamar.',
    )
  }
  if (!captura.lugar) {
    avisos.push('Sin lugar, quien vaya tiene que buscarlo el mismo día.')
  }

  return avisos
}

// ── Diferimiento ────────────────────────────────────────────────────────────

export interface CapturaDiferimiento {
  fechaNueva: FechaISO | null
  hora: string | null
  motivo: string | null
}

export function leerDiferimiento(
  campos: Record<string, string>,
): CapturaDiferimiento {
  const fecha = campos.fechaNueva?.trim()
  return {
    fechaNueva: esFechaISO(fecha) ? fecha : null,
    hora: leerHora(campos.hora),
    motivo: texto(campos, 'motivo'),
  }
}

const LARGO_MIN_MOTIVO = 8

export function validarDiferimiento(
  captura: CapturaDiferimiento,
  fechaAnterior: FechaISO,
): Problema[] {
  const problemas: Problema[] = []

  if (!captura.fechaNueva) {
    problemas.push({
      campo: 'fechaNueva',
      mensaje: 'Captura la fecha para la que se difirió.',
    })
  } else if (captura.fechaNueva <= fechaAnterior) {
    // Diferir es mover hacia adelante. Una fecha anterior es un error de
    // captura, y el que se cuela es el año.
    problemas.push({
      campo: 'fechaNueva',
      mensaje: 'La nueva fecha tiene que ser posterior a la que se difirió.',
    })
  }

  if (!captura.motivo || captura.motivo.length < LARGO_MIN_MOTIVO) {
    problemas.push({
      campo: 'motivo',
      mensaje: 'Escribe por qué se difirió. Es lo que se le explica al cliente.',
    })
  }

  return problemas
}

/** Cómo queda asentado el diferimiento en la bitácora. */
export function anotacionDeDiferimiento(
  tipo: string,
  fechaAnterior: FechaISO,
  captura: CapturaDiferimiento,
): { titulo: string; detalle: string } {
  return {
    titulo: `Se difirió la ${tipo.toLowerCase()}`,
    detalle: `Estaba señalada para el ${fechaAnterior} y se difirió al ${captura.fechaNueva}. Motivo: ${captura.motivo}`,
  }
}

// ── Cierre de la audiencia ──────────────────────────────────────────────────

export interface CapturaCelebracion {
  resultado: string | null
}

export function validarCelebracion(
  captura: CapturaCelebracion,
): Problema[] {
  if (!captura.resultado || captura.resultado.trim().length < 8) {
    // Qué pasó en la audiencia ES la audiencia. Marcarla celebrada sin decirlo
    // deja en el expediente un día en blanco que nadie va a poder reconstruir.
    return [
      {
        campo: 'resultado',
        mensaje: 'Escribe qué pasó. Sin eso, en el expediente queda un día en blanco.',
      },
    ]
  }
  return []
}

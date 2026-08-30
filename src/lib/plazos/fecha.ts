/**
 * Aritmética de fechas civiles, sin husos horarios.
 *
 * POR QUÉ NO SE USA `Date` DIRECTO: un plazo procesal es una fecha de
 * calendario, no un instante. `new Date('2026-03-15')` se interpreta como
 * medianoche UTC y, al imprimirla en America/Mexico_City (UTC-6), se corre al
 * día 14. Ese error de un día es exactamente el que hace perder un término.
 *
 * Aquí todo se representa como cadena ISO `yyyy-mm-dd` y toda la aritmética
 * ocurre en UTC, que no tiene horario de verano. La conversión a hora local
 * sucede solo al formatear para pantalla, nunca al calcular.
 */

/** Fecha civil en formato `yyyy-mm-dd`. */
export type FechaISO = string

const PATRON_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

const MS_POR_DIA = 24 * 60 * 60 * 1000

/** ¿La cadena es una fecha civil válida y existente? */
export function esFechaISO(valor: unknown): valor is FechaISO {
  if (typeof valor !== 'string') return false
  const m = PATRON_ISO.exec(valor)
  if (!m) return false
  const [, a, mes, d] = m
  const anio = Number(a)
  const numMes = Number(mes)
  const dia = Number(d)
  if (numMes < 1 || numMes > 12 || dia < 1 || dia > 31) return false
  // Se reconstruye para descartar fechas que no existen (31 de febrero).
  const t = Date.UTC(anio, numMes - 1, dia)
  const fecha = new Date(t)
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === numMes - 1 &&
    fecha.getUTCDate() === dia
  )
}

/** Lanza si la fecha no es válida. Se usa en las fronteras del motor. */
export function exigirFechaISO(valor: unknown, campo: string): FechaISO {
  if (!esFechaISO(valor)) {
    throw new TypeError(
      `${campo}: se esperaba una fecha 'yyyy-mm-dd' válida y llegó ${JSON.stringify(valor)}`,
    )
  }
  return valor
}

/** Milisegundos UTC de la medianoche de esa fecha civil. */
function aTiempo(fecha: FechaISO): number {
  const m = PATRON_ISO.exec(fecha)
  if (!m) throw new TypeError(`Fecha inválida: ${fecha}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Vuelve de milisegundos UTC a `yyyy-mm-dd`. */
function aFecha(tiempo: number): FechaISO {
  return new Date(tiempo).toISOString().slice(0, 10)
}

/** Suma (o resta, con negativo) días naturales. */
export function sumarDias(fecha: FechaISO, dias: number): FechaISO {
  return aFecha(aTiempo(fecha) + dias * MS_POR_DIA)
}

/** Días naturales entre dos fechas (`hasta - desde`). Negativo si va al revés. */
export function diferenciaEnDias(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aTiempo(hasta) - aTiempo(desde)) / MS_POR_DIA)
}

/** 0 = domingo … 6 = sábado. */
export function diaDeLaSemana(fecha: FechaISO): number {
  return new Date(aTiempo(fecha)).getUTCDay()
}

export function esFinDeSemana(fecha: FechaISO): boolean {
  const d = diaDeLaSemana(fecha)
  return d === 0 || d === 6
}

/** -1, 0 o 1. Como las fechas son ISO, basta comparar como cadenas. */
export function comparar(a: FechaISO, b: FechaISO): number {
  return a < b ? -1 : a > b ? 1 : 0
}

/** ¿`fecha` cae dentro de [desde, hasta], ambos inclusive? */
export function dentroDeRango(
  fecha: FechaISO,
  desde: FechaISO,
  hasta: FechaISO,
): boolean {
  return fecha >= desde && fecha <= hasta
}

/** Hoy, en el calendario de la Ciudad de México (no en el del servidor). */
export function hoyEnMexico(ahora: Date = new Date()): FechaISO {
  // `en-CA` produce yyyy-mm-dd, que es justo el formato que usamos.
  return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

/** Formato largo en español para pantalla y correos: "12 de marzo de 2026". */
export function fechaLarga(fecha: FechaISO): string {
  if (!esFechaISO(fecha)) return ''
  // Se fuerza UTC porque la fecha ya es civil: no debe reinterpretarse.
  return new Date(aTiempo(fecha)).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** "jueves 12 de marzo de 2026" — para el detalle del cómputo. */
export function fechaLargaConDia(fecha: FechaISO): string {
  if (!esFechaISO(fecha)) return ''
  return new Date(aTiempo(fecha)).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

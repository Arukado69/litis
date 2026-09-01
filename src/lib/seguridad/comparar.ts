import { timingSafeEqual } from 'node:crypto'

/**
 * Compara dos secretos en tiempo constante.
 *
 * Con `===`, el tiempo que tarda la comparación delata cuántos caracteres
 * iniciales acertó quien está probando. Con eso, un secreto se reconstruye byte
 * por byte en vez de adivinarse entero — que es la diferencia entre
 * "imposible" y "una tarde".
 *
 * Hay UNA sola implementación de esta regla, a propósito: la usan el token de
 * invitación y el secreto del cron, y dos copias se separarían con el tiempo.
 *
 * `timingSafeEqual` lanza si los buffers miden distinto, así que la longitud se
 * revisa antes. Eso sí filtra la longitud del secreto, y es aceptable: saber
 * cuántos caracteres mide un token de 256 bits no acerca a nadie a adivinarlo.
 */
export function mismoSecreto(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

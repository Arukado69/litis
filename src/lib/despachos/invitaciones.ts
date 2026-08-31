/**
 * Invitaciones al despacho (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL TOKEN ES LA LLAVE DE UN DESPACHO ENTERO
 * ─────────────────────────────────────────────────────────────────────────────
 * Quien tenga el enlace y el correo correcto entra a ver todos los expedientes,
 * los datos de los clientes y los términos. Así que:
 *
 *   · Se genera con el generador criptográfico del sistema, no con `Math.random`.
 *     Un token predecible se adivina en un `for`, y aquí adivinar equivale a
 *     entrar.
 *   · A la base va **solo el sha-256**. El token en claro vive una vez, en la
 *     respuesta de la acción que lo creó, y de ahí se va al correo. Perder el
 *     enlace obliga a reinvitar — que es lo correcto.
 *   · Caduca en siete días. Un enlace eterno en un correo viejo es una puerta
 *     abierta que nadie está viendo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUIÉN PUEDE INVITAR, Y A QUÉ
 * ─────────────────────────────────────────────────────────────────────────────
 * Solo el **titular**. Un abogado que pudiera invitar podría meter a cualquiera
 * a ver el despacho completo, restringidos incluidos, sin que el dueño se
 * entere. Lo hace cumplir también la política de RLS de la `0009`.
 *
 * Y no se invita como `titular`: hay uno, es quien creó el despacho, y
 * transferir la titularidad es otra operación con otras consecuencias.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import type { RolMembresia } from '@/types/db'

export interface Problema {
  campo: string
  mensaje: string
}

/** Los roles que un titular puede repartir. `titular` y `cliente` quedan fuera. */
export const ROLES_INVITABLES: readonly RolMembresia[] = [
  'abogado',
  'pasante',
  'asistente',
]

export const ROL_MEMBRESIA_ETIQUETA: Record<RolMembresia, string> = {
  titular: 'Titular',
  abogado: 'Abogado',
  pasante: 'Pasante',
  asistente: 'Asistente',
  cliente: 'Cliente',
}

/** Qué alcanza a hacer cada rol, en una línea, para la pantalla. */
export const ROL_ALCANCE: Record<RolMembresia, string> = {
  titular: 'Manda en el despacho: invita, da de baja y ve todo.',
  abogado: 'Lleva expedientes con firma y puede cancelar plazos.',
  pasante: 'Apoya en los expedientes; no cancela plazos ni cierra el asunto.',
  asistente: 'Captura y agenda.',
  cliente: 'Solo lectura de sus propios expedientes.',
}

/** Días que vive una invitación. */
export const DIAS_DE_VIGENCIA = 7

// ── El token ────────────────────────────────────────────────────────────────

/**
 * Un token nuevo, en base64url.
 *
 * 32 bytes = 256 bits de entropía real. No es exceso: es la diferencia entre
 * "no se adivina" y "se adivina si alguien se lo propone".
 */
export function generarToken(): string {
  return randomBytes(32).toString('base64url')
}

/** El sha-256 en hexadecimal. Es lo único que toca la base. */
export function hashDeToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Compara dos hashes en tiempo constante.
 *
 * Comparar con `===` filtra, por el tiempo que tarda, cuántos caracteres
 * iniciales acertó quien prueba. Con eso un token se reconstruye byte por byte
 * en vez de adivinarse entero.
 */
export function mismoHash(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  if (x.length !== y.length) return false
  return timingSafeEqual(x, y)
}

// ── La captura ──────────────────────────────────────────────────────────────

export interface CapturaInvitacion {
  correo: string
  rol: RolMembresia
}

/**
 * Un correo, normalizado.
 *
 * Minúsculas y recortado, porque se compara contra el de la sesión al aceptar
 * y "Nadia@X.com" no debe fallar contra "nadia@x.com".
 */
export function normalizarCorreo(valor: string | undefined): string {
  return (valor ?? '').trim().toLowerCase()
}

export function leerInvitacion(
  campos: Record<string, string>,
): CapturaInvitacion {
  const rol = campos.rol as RolMembresia
  return {
    correo: normalizarCorreo(campos.correo),
    rol: ROLES_INVITABLES.includes(rol) ? rol : 'abogado',
  }
}

/** Comprobación deliberadamente laxa: la de verdad la hace el correo al llegar. */
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface ContextoInvitacion {
  /** Correos que ya están dentro del despacho, normalizados. */
  correosDelEquipo: readonly string[]
  /** Correos con invitación pendiente, normalizados. */
  correosInvitados: readonly string[]
  /** El de quien invita: no tiene caso invitarse a sí mismo. */
  correoDeQuienInvita: string
}

export function validarInvitacion(
  captura: CapturaInvitacion,
  contexto: ContextoInvitacion,
): Problema[] {
  const problemas: Problema[] = []

  if (!PATRON_CORREO.test(captura.correo)) {
    problemas.push({ campo: 'correo', mensaje: 'Escribe un correo válido.' })
    return problemas
  }

  if (captura.correo === normalizarCorreo(contexto.correoDeQuienInvita)) {
    problemas.push({ campo: 'correo', mensaje: 'Ese es tu propio correo.' })
    return problemas
  }

  if (contexto.correosDelEquipo.includes(captura.correo)) {
    problemas.push({
      campo: 'correo',
      mensaje: 'Esa persona ya está en el despacho.',
    })
    return problemas
  }

  if (contexto.correosInvitados.includes(captura.correo)) {
    // Reinvitar sin cerrar la anterior deja dos enlaces vivos, y revocar uno no
    // cierra el otro.
    problemas.push({
      campo: 'correo',
      mensaje:
        'Ya hay una invitación pendiente para ese correo. Revócala si quieres mandar una nueva.',
    })
  }

  if (!ROLES_INVITABLES.includes(captura.rol)) {
    problemas.push({ campo: 'rol', mensaje: 'Ese papel no se puede invitar.' })
  }

  return problemas
}

/** Cuándo caduca una invitación creada ahora. */
export function expiraEl(ahora: Date = new Date()): Date {
  return new Date(ahora.getTime() + DIAS_DE_VIGENCIA * 24 * 60 * 60 * 1000)
}

export function estaVigente(
  invitacion: { estado: string; expiraEl: string },
  ahora: Date = new Date(),
): boolean {
  return (
    invitacion.estado === 'pendiente' &&
    new Date(invitacion.expiraEl).getTime() >= ahora.getTime()
  )
}

/**
 * El enlace que se manda.
 *
 * ⚠️ El origen sale de la configuración, **nunca del header `Host`**: quien
 * manda la petición lo controla, y con `Host: evil.com` el titular recibiría un
 * correo legítimo con un enlace al servidor de un tercero — que se quedaría con
 * el token.
 */
export function enlaceDeInvitacion(origen: string, token: string): string {
  return `${origen.replace(/\/+$/, '')}/invitacion/${token}`
}

// ── Bajas y cambios de papel ────────────────────────────────────────────────

export interface MiembroDelEquipo {
  perfilId: string
  nombre: string
  correo: string | null
  rol: RolMembresia
  estado: string
}

/**
 * ¿Se puede dar de baja a esta persona?
 *
 * El titular no. Un despacho sin titular no tiene quién invite, quién dé de
 * baja ni quién cancele un plazo — y nadie puede arreglarlo desde dentro.
 * Transferir la titularidad es otra operación; hasta que exista, el titular no
 * se va.
 */
export function puedeDarDeBaja(
  miembro: MiembroDelEquipo,
  quienPideId: string,
): Problema | null {
  if (miembro.rol === 'titular') {
    return {
      campo: 'perfilId',
      mensaje:
        'El titular no se puede dar de baja: el despacho quedaría sin quien invite ni administre.',
    }
  }
  if (miembro.perfilId === quienPideId) {
    return {
      campo: 'perfilId',
      mensaje: 'No puedes darte de baja a ti mismo desde aquí.',
    }
  }
  return null
}

/**
 * ¿Se le puede cambiar el papel?
 *
 * Al titular no, por lo mismo de arriba, y a nadie se le puede poner `titular`:
 * habría dos, y la pregunta "quién manda" dejaría de tener respuesta.
 */
export function puedeCambiarRol(
  miembro: MiembroDelEquipo,
  nuevoRol: RolMembresia,
): Problema | null {
  if (miembro.rol === 'titular') {
    return {
      campo: 'rol',
      mensaje: 'El papel del titular no se cambia desde aquí.',
    }
  }
  if (!ROLES_INVITABLES.includes(nuevoRol)) {
    return {
      campo: 'rol',
      mensaje: 'Ese papel no se puede asignar.',
    }
  }
  return null
}

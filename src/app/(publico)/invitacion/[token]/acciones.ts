'use server'

import { redirect } from 'next/navigation'

import { hashDeToken, normalizarCorreo } from '@/lib/despachos/invitaciones'
import {
  anotarFallo,
  evaluarAcceso,
  mensajeDeEspera,
  perdonarAcceso,
} from '@/lib/seguridad/limite-intentos'
import { ipDeLaPeticion } from '@/lib/seguridad/peticion'
import { clienteServidor } from '@/lib/supabase/server'

import { type EstadoAceptar } from './estado'

function conError(
  valores: Record<string, string>,
  error: string,
): EstadoAceptar {
  return { valores, error, problemas: {} }
}

const LARGO_MIN_CONTRASENA = 8

/**
 * Acepta una invitación: crea la cuenta si hace falta, entra y toma la
 * membresía.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ENLACE NO BASTA: TAMBIÉN TIENE QUE SER SU CORREO
 * ─────────────────────────────────────────────────────────────────────────────
 * La cuenta se crea o se abre con el correo AL QUE SE INVITÓ, no con uno que
 * teclee quien llegó. Y la función de la base vuelve a comprobar que el correo
 * de la sesión coincida con el de la invitación.
 *
 * Es a propósito: un enlace reenviado —por descuido, por un correo que se
 * archiva mal, o a propósito— le daría a un tercero acceso a los expedientes,
 * los datos fiscales y los términos de los clientes de un despacho. El titular
 * invitó a una persona concreta.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FRENO ANTI-FUERZA-BRUTA
 * ─────────────────────────────────────────────────────────────────────────────
 * Esta es una ruta pública que escribe y cuya llave es un token. Sin freno, un
 * script prueba tokens hasta entrar. El token tiene 256 bits y no se adivina en
 * la práctica, pero el freno cuesta cuatro líneas y la puerta que protege es un
 * despacho entero.
 */
export async function aceptarInvitacion(
  _previo: EstadoAceptar,
  formData: FormData,
): Promise<EstadoAceptar> {
  const token = String(formData.get('token') ?? '')
  const nombre = String(formData.get('nombre') ?? '').trim()
  const contrasena = String(formData.get('contrasena') ?? '')
  const valores = { nombre }

  if (token.length === 0) return conError(valores, 'Falta el enlace de invitación.')

  const ip = await ipDeLaPeticion()
  const ctx = { ip, correo: `invitacion:${token.slice(0, 12)}` }
  const veredicto = evaluarAcceso(ctx)
  if (!veredicto.permitido) return conError(valores, mensajeDeEspera(veredicto))

  const supabase = await clienteServidor()
  const tokenHash = hashDeToken(token)

  // Qué invitación es y a quién. Viene de la función de la base porque quien
  // acepta todavía no puede leer la tabla.
  const { data: vistazo } = await supabase.rpc('mirar_invitacion', {
    p_token_hash: tokenHash,
  })
  const invitacion = vistazo?.[0]

  if (!invitacion || !invitacion.vigente) {
    anotarFallo(ctx)
    return conError(
      valores,
      'Esta invitación ya no sirve: puede haber caducado, haberse usado o haber sido revocada. Pídele al titular que te mande otra.',
    )
  }

  const correo = normalizarCorreo(invitacion.correo)

  // ── Entrar, o crear la cuenta si no existe ───────────────────────────────
  const { data: sesionExistente } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  })

  if (!sesionExistente.session) {
    if (contrasena.length < LARGO_MIN_CONTRASENA) {
      return conError(
        valores,
        `La contraseña necesita al menos ${LARGO_MIN_CONTRASENA} caracteres. Si ya tenías cuenta con ${correo}, escribe la tuya.`,
      )
    }
    if (nombre.length < 3) {
      return conError(valores, 'Escribe tu nombre completo.')
    }

    const { data: alta, error: errorAlta } = await supabase.auth.signUp({
      // El correo lo pone la invitación, NUNCA el formulario.
      email: correo,
      password: contrasena,
      options: { data: { nombre } },
    })

    if (errorAlta || !alta.session) {
      anotarFallo(ctx)
      return conError(
        valores,
        errorAlta
          ? 'No se pudo crear la cuenta. Si ya tenías una con este correo, escribe tu contraseña de siempre.'
          : 'Te mandamos un correo para confirmar la cuenta. Ábrelo, entra, y vuelve a abrir este enlace de invitación.',
      )
    }
  }

  perdonarAcceso(ctx)

  // La membresía la crea la base, que vuelve a verificar vigencia y correo.
  const { error } = await supabase.rpc('aceptar_invitacion', {
    p_token_hash: tokenHash,
    p_nombre: nombre,
  })

  if (error) {
    return conError(
      valores,
      error.code === '23505'
        ? 'Esa cuenta ya pertenece a un despacho. Una cuenta entra a uno solo.'
        : 'No se pudo aceptar la invitación. Puede que haya caducado mientras llenabas el formulario.',
    )
  }

  // Cada quien a su herramienta. Mandar a todos a /panel funciona —el guardia
  // rebota al cliente hacia /portal— pero le enseña por un instante una
  // pantalla que no es la suya.
  redirect(invitacion.rol === 'cliente' ? '/portal' : '/panel')
}

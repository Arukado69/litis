'use server'

import { redirect } from 'next/navigation'

import {
  anotarFallo,
  evaluarAcceso,
  mensajeDeEspera,
  perdonarAcceso,
} from '@/lib/seguridad/limite-intentos'
import { ipDeLaPeticion } from '@/lib/seguridad/peticion'
import { clienteServidor } from '@/lib/supabase/server'

import type { EstadoAcceso } from './estado'

/**
 * Mensaje único para credenciales malas.
 *
 * No distingue "ese correo no existe" de "la contraseña no es". Distinguirlos
 * convierte la pantalla de acceso en un verificador de cuentas: un atacante
 * prueba correos hasta encontrar los que sí están registrados y luego concentra
 * el ataque ahí.
 */
const CREDENCIALES_MALAS = 'Correo o contraseña incorrectos.'

/**
 * Solo se acepta un destino relativo. Aceptar una URL completa aquí sería un
 * redirect abierto: `/acceso?destino=https://evil.com` mandaría al usuario
 * recién autenticado a un sitio ajeno con toda la apariencia de legitimidad.
 *
 * Se exige que empiece con una sola `/`: `//evil.com` es una URL protocolo-
 * relativa que el navegador resuelve como externa.
 */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const destino = typeof valor === 'string' ? valor : ''
  return /^\/(?!\/)/.test(destino) ? destino : '/panel'
}

export async function iniciarSesion(
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  const correo = String(formData.get('correo') ?? '').trim()
  const contrasena = String(formData.get('contrasena') ?? '')
  const destino = destinoSeguro(formData.get('destino'))

  if (!correo || !contrasena) {
    return { error: 'Captura tu correo y tu contraseña.' }
  }

  const ctx = { ip: await ipDeLaPeticion(), correo }

  const veredicto = evaluarAcceso(ctx)
  if (!veredicto.permitido) return { error: mensajeDeEspera(veredicto) }

  const supabase = await clienteServidor()
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  })

  if (error) {
    const tras = anotarFallo(ctx)
    return {
      error: tras.permitido ? CREDENCIALES_MALAS : mensajeDeEspera(tras),
    }
  }

  // Solo los fallos cuentan: sin esto, quien entra bien varias veces en la
  // mañana acabaría bloqueándose solo.
  perdonarAcceso(ctx)

  // Fuera del try: `redirect` funciona lanzando, y atraparlo lo rompería.
  redirect(destino)
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await clienteServidor()
  await supabase.auth.signOut()
  redirect('/acceso')
}

import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import type { Database } from '@/types/db'

import { envSupabasePublico } from './env'

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 *
 * Corre con la sesión del usuario, así que **toda la RLS aplica**. Es el
 * cliente por omisión: si una consulta no devuelve lo que esperas, la respuesta
 * casi siempre es que una política lo está bloqueando bien, no que haga falta
 * el cliente de servicio.
 */
export async function clienteServidor() {
  const almacen = await cookies()
  const { url, anonKey } = envSupabasePublico()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return almacen.getAll()
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) {
            almacen.set(name, value, options)
          }
        } catch {
          // Un Server Component no puede escribir cookies. Se ignora a
          // propósito: el proxy ya refresca la sesión en cada petición, así que
          // el token se renueva por ahí y aquí no se pierde nada.
        }
      },
    },
  })
}

/**
 * El usuario de la sesión, o `null`.
 *
 * Usa `getUser()` y no `getSession()`: `getSession()` lee la cookie sin
 * validarla contra el servidor de auth, y una cookie se puede fabricar. Para
 * decidir permisos, solo sirve el usuario verificado.
 */
export async function usuarioActual() {
  const supabase = await clienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

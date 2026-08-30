import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/types/db'

/**
 * Proxy: refresca la sesión y bloquea la entrada a las rutas privadas.
 *
 * (Next 16 sustituyó `middleware.ts` por `proxy.ts`. Mismo runtime, mismo
 * `config.matcher`; solo cambia el nombre del archivo.)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ES LA PRIMERA CAPA DE TRES, NO LA ÚNICA
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Aquí: redirección temprana, para que quien no traiga sesión no llegue a
 *      renderizar nada.
 *   2. El layout del grupo de rutas: guardia de rol.
 *   3. La RLS en Postgres: la red final.
 *
 * Este archivo NO decide permisos finos y no debe hacerlo. Un proxy que se
 * cree la autoridad de autorización es un proxy que algún día deja pasar algo
 * porque el `matcher` no cubría una ruta nueva. Aquí solo se pregunta "¿hay
 * sesión?"; el "¿puede ver esto?" vive en la base.
 */
export async function proxy(request: NextRequest) {
  // Se arranca de la petición para conservar las cookies entrantes; sobre esta
  // respuesta se escriben las que Supabase renueve.
  let respuesta = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Sin configuración no se puede validar nada. Se deja pasar porque las capas
  // 2 y 3 siguen ahí, y tumbar toda la aplicación por una variable faltante en
  // un entorno de desarrollo sin Supabase es peor que dejar que el layout
  // muestre el error real.
  if (!url || !anonKey) return respuesta

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesNuevas) {
        for (const { name, value } of cookiesNuevas) {
          request.cookies.set(name, value)
        }
        respuesta = NextResponse.next({ request })
        for (const { name, value, options } of cookiesNuevas) {
          respuesta.cookies.set(name, value, options)
        }
      },
    },
  })

  // ⚠️ `getUser()` y no `getSession()`: la sesión se lee de la cookie sin
  // validar, y una cookie se puede fabricar. Además, esta llamada es la que
  // refresca el token — quitarla cierra la sesión de los usuarios cada hora.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const ruta = request.nextUrl.pathname
  const esPrivada =
    ruta.startsWith('/panel') ||
    ruta.startsWith('/portal') ||
    // Hay sesión pero todavía no despacho: sigue siendo zona privada.
    ruta.startsWith('/bienvenida')

  if (esPrivada && !user) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/acceso'
    // Para devolverlo a donde iba después de entrar. Se guarda solo la ruta
    // relativa: aceptar una URL completa aquí sería un redirect abierto.
    destino.searchParams.set('destino', ruta)
    return NextResponse.redirect(destino)
  }

  return respuesta
}

export const config = {
  /**
   * Se excluyen los estáticos y las imágenes: hacer una llamada de red a
   * Supabase por cada icono es gasto puro y hace lenta toda la navegación.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
}

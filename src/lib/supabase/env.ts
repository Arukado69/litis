/**
 * Lectura y validación de las variables de Supabase.
 *
 * Existe para que una variable faltante falle al arrancar, con un mensaje que
 * diga cuál falta, en vez de convertirse en un `undefined` que viaja hasta una
 * llamada de red y revienta como "Invalid URL" en producción.
 */

export interface EnvSupabasePublico {
  url: string
  anonKey: string
}

function exigir(nombre: string, valor: string | undefined): string {
  const limpio = valor?.trim()
  if (!limpio) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. Cópiala de .env.example a .env.local.`,
    )
  }
  return limpio
}

/**
 * Las públicas. Viajan al navegador y está bien: la clave anónima está pensada
 * para eso y, sin RLS, no sirve de nada. La que jamás puede salir es la de
 * servicio.
 *
 * ⚠️ Se leen como `process.env.NEXT_PUBLIC_*` LITERAL y no por variable: Next
 * las sustituye en tiempo de compilación buscando el texto exacto. Un acceso
 * dinámico como `process.env[nombre]` queda `undefined` en el navegador.
 */
export function envSupabasePublico(): EnvSupabasePublico {
  return {
    url: exigir('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: exigir(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  }
}

/**
 * La clave de servicio. Salta TODA la RLS.
 *
 * Solo puede usarse en el servidor y solo en dos lugares: el alta de despacho
 * —cuando el usuario todavía no tiene membresía y no puede pasar ninguna
 * política— y el cron de alertas, que corre sin sesión. Cualquier otro uso es
 * un error de diseño: significa que una política de RLS está estorbando, y la
 * respuesta correcta es arreglar la política, no saltársela.
 */
export function envServiceRoleKey(): string {
  return exigir('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * El origen del sitio, para armar enlaces de correo.
 *
 * ⚠️ NUNCA se deriva del header `Host`. Quien manda la petición controla ese
 * header: con `Host: evil.com` en la recuperación de contraseña, la víctima
 * recibe un correo legítimo cuyo enlace lleva su token al servidor del
 * atacante.
 */
export function envSitioUrl(): string {
  return exigir('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL).replace(
    /\/+$/,
    '',
  )
}

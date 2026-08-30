import 'server-only'

import { createClient } from '@supabase/supabase-js'

import type { Database } from '@/types/db'

import { envServiceRoleKey, envSupabasePublico } from './env'

/**
 * Cliente con clave de servicio. **SALTA TODA LA RLS.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO DOS USOS LEGÍTIMOS
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. **Alta de despacho.** Quien acaba de registrarse todavía no tiene
 *      membresía, así que no puede pasar ninguna política para crear la
 *      primera fila. Es el problema del huevo y la gallina.
 *   2. **El cron de alertas**, que corre sin sesión de usuario.
 *
 * Cualquier otro uso es un error de diseño. Si aparece la tentación de usarlo
 * "porque la RLS estorba", lo que hay que arreglar es la política.
 *
 * ⚠️ **Nunca se expone detrás de un endpoint sin sesión.** Un Route Handler que
 * use este cliente y no verifique quién llama es acceso total a la base de
 * todos los despachos, por HTTP y sin contraseña.
 *
 * `persistSession: false` porque no hay usuario que recordar, y guardar estado
 * entre invocaciones en un entorno de servidor es una forma de filtrar
 * contexto de una petición a otra.
 */
export function clienteServicio() {
  const { url } = envSupabasePublico()

  return createClient<Database>(url, envServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

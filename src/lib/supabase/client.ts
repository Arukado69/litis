'use client'

import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/types/db'

import { envSupabasePublico } from './env'

/**
 * Cliente para Client Components.
 *
 * Se usa solo donde hace falta interactividad de verdad: iniciar sesión,
 * cerrar sesión, suscribirse a cambios. Las lecturas de datos van en Server
 * Components, que es más rápido y no expone la forma de las consultas.
 */
export function clienteNavegador() {
  const { url, anonKey } = envSupabasePublico()
  return createBrowserClient<Database>(url, anonKey)
}

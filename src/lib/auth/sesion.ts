import 'server-only'

import { redirect } from 'next/navigation'

import { clienteServidor } from '@/lib/supabase/server'
import type { RolMembresia } from '@/types/db'

/**
 * Contexto de sesión: quién entró y con qué papel, en qué despacho.
 *
 * Es la segunda de las tres capas de seguridad (proxy → layout → RLS). Aquí se
 * decide qué pantalla se muestra; **quién puede leer qué fila lo sigue
 * decidiendo la RLS**. Si alguna vez estas dos discrepan, manda la base: esta
 * capa existe para dar un mensaje decente, no para ser la cerradura.
 */

export interface Membresia {
  despachoId: string
  despachoNombre: string
  despachoSlug: string
  rol: RolMembresia
  personaId: string | null
}

export interface Sesion {
  usuarioId: string
  correo: string
  nombre: string
  membresias: readonly Membresia[]
  /** El despacho sobre el que se está trabajando. */
  activa: Membresia
}

/** Roles que NO son cliente. El cliente ve su portal, no el panel. */
export function esPersonal(rol: RolMembresia): boolean {
  return rol !== 'cliente'
}

/**
 * La sesión, o `null` si no hay usuario o no tiene despacho.
 *
 * Devolver `null` en los dos casos es deliberado: una cuenta sin membresía no
 * puede hacer nada en el sistema, así que para efectos de las pantallas es
 * indistinguible de no haber entrado. Quien necesite separarlos —el registro a
 * medias, por ejemplo— usa `usuarioSinDespacho()`.
 */
export async function sesionActual(): Promise<Sesion | null> {
  const supabase = await clienteServidor()

  // getUser() y no getSession(): la cookie se puede fabricar, y para decidir
  // permisos solo sirve el usuario validado contra el servidor de auth.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('membresias')
    .select(
      'rol, persona_id, despacho_id, despachos(nombre, slug), perfiles(nombre, correo)',
    )
    .eq('perfil_id', user.id)
    .eq('estado', 'activa')

  if (error || !data || data.length === 0) return null

  const membresias: Membresia[] = data.flatMap((fila) => {
    // El join llega como objeto o como arreglo según la forma de la relación;
    // se normaliza para no depender de eso.
    const despacho = Array.isArray(fila.despachos)
      ? fila.despachos[0]
      : fila.despachos
    if (!despacho) return []

    return [
      {
        despachoId: fila.despacho_id,
        despachoNombre: despacho.nombre,
        despachoSlug: despacho.slug,
        rol: fila.rol,
        personaId: fila.persona_id,
      },
    ]
  })

  const activa = membresias[0]
  if (!activa) return null

  const perfil = Array.isArray(data[0]?.perfiles)
    ? data[0]?.perfiles[0]
    : data[0]?.perfiles

  return {
    usuarioId: user.id,
    correo: perfil?.correo ?? user.email ?? '',
    nombre: perfil?.nombre ?? '',
    membresias,
    activa,
  }
}

/** Hay usuario pero todavía no tiene despacho: registro a medias. */
export async function usuarioSinDespacho(): Promise<boolean> {
  const supabase = await clienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { count } = await supabase
    .from('membresias')
    .select('id', { count: 'exact', head: true })
    .eq('perfil_id', user.id)
    .eq('estado', 'activa')

  return (count ?? 0) === 0
}

/**
 * La sesión o una redirección. Es la guardia que usan los layouts privados.
 *
 * El cliente que intente entrar al panel se va a su portal, no a un 403: no
 * hizo nada malo, simplemente ese no es su lugar.
 */
export async function exigirPanel(): Promise<Sesion> {
  const sesion = await sesionActual()
  if (!sesion) {
    // Hay que separar "no entró" de "entró pero le falta el despacho". Mandar
    // al segundo a /acceso lo dejaría rebotando entre las dos pantallas: entra
    // bien, no tiene despacho, lo devuelven a entrar.
    if (await usuarioSinDespacho()) redirect('/bienvenida')
    redirect('/acceso')
  }
  if (!esPersonal(sesion.activa.rol)) redirect('/portal')
  return sesion
}

/** Igual, para el portal del cliente. */
export async function exigirPortal(): Promise<Sesion> {
  const sesion = await sesionActual()
  if (!sesion) {
    if (await usuarioSinDespacho()) redirect('/bienvenida')
    redirect('/acceso')
  }
  // El personal no tiene `persona_id`, así que en el portal no vería nada: un
  // despacho que entra aquí por error se topa con una pantalla vacía y cree
  // que algo se rompió. Se le devuelve a su herramienta.
  if (esPersonal(sesion.activa.rol)) redirect('/panel')
  return sesion
}

'use server'

import { redirect } from 'next/navigation'

import { slugDeDespacho } from '@/lib/despachos/alta'
import { clienteServidor } from '@/lib/supabase/server'

import type { EstadoBienvenida } from './estado'

/**
 * Cierra el registro para quien tuvo que confirmar su correo: crea el despacho
 * y la membresía de titular.
 *
 * No lleva freno anti-fuerza-bruta propio: para llegar aquí ya hay que tener
 * sesión válida, y la propia función de la base impide que una cuenta cree más
 * de un despacho.
 */
export async function crearDespacho(
  _previo: EstadoBienvenida,
  formData: FormData,
): Promise<EstadoBienvenida> {
  const nombreDespacho = String(formData.get('nombreDespacho') ?? '').trim()
  const nombre = String(formData.get('nombre') ?? '').trim()

  if (nombreDespacho.length < 3) {
    return { error: 'Escribe el nombre del despacho.' }
  }
  if (nombre.length < 2) {
    return { error: 'Escribe tu nombre.' }
  }

  const supabase = await clienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/acceso')

  const { error } = await supabase.rpc('crear_mi_despacho', {
    p_nombre_titular: nombre,
    p_correo: user.email ?? '',
    p_despacho_nombre: nombreDespacho,
    p_slug_base: slugDeDespacho(nombreDespacho),
  })

  if (error) {
    // `23505` es el candado de "esta cuenta ya tiene despacho": pasa cuando se
    // manda el formulario dos veces o cuando ya se creó en otra pestaña. No es
    // un fallo desde el punto de vista del usuario, así que se le deja pasar.
    if (error.code === '23505') redirect('/panel')

    return {
      error: 'No se pudo crear el despacho. Vuelve a intentar en un momento.',
    }
  }

  redirect('/panel')
}

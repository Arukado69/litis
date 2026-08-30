import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { Tarjeta } from '@/components/ui/primitivos'
import { clienteServidor } from '@/lib/supabase/server'

import { FormularioBienvenida } from './formulario'

export const metadata: Metadata = { title: 'Crear despacho' }

/**
 * Cierra el registro de quien tuvo que confirmar su correo.
 *
 * Los datos vienen de los metadatos que guardó el registro, así que no se le
 * vuelve a preguntar lo que ya escribió. Si por alguna razón no están, los
 * campos salen vacíos y los captura.
 */
export default async function PaginaBienvenida() {
  const supabase = await clienteServidor()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/acceso')

  // Quien ya tiene despacho no hace nada aquí.
  const { count } = await supabase
    .from('membresias')
    .select('id', { count: 'exact', head: true })
    .eq('perfil_id', user.id)
    .eq('estado', 'activa')

  if ((count ?? 0) > 0) redirect('/panel')

  const metadatos = user.user_metadata ?? {}
  const nombreSugerido =
    typeof metadatos.nombre === 'string' ? metadatos.nombre : ''
  const despachoSugerido =
    typeof metadatos.despacho_nombre === 'string'
      ? metadatos.despacho_nombre
      : ''

  return (
    <Tarjeta className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Falta un paso
        </h1>
        <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
          Confirma el nombre del despacho y entras.
        </p>
      </div>

      <FormularioBienvenida
        nombreSugerido={nombreSugerido}
        despachoSugerido={despachoSugerido}
      />
    </Tarjeta>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { Tenue } from '@/components/ui/composicion'
import { Foja } from '@/components/ui/primitivos'

import { FormularioAcceso } from './formulario'

export const metadata: Metadata = { title: 'Entrar' }

/**
 * `destino` llega del proxy cuando alguien intentó abrir una ruta privada sin
 * sesión. Aquí solo se transporta; la Server Action lo valida antes de
 * redirigir, porque un destino que venga de la URL es dato del atacante.
 */
export default async function PaginaAcceso({
  searchParams,
}: {
  searchParams: Promise<{ destino?: string }>
}) {
  const { destino } = await searchParams

  return (
    <Foja className="flex flex-col gap-5">
      <div>
        <h1 className="text-rotulo">Entrar</h1>
        <Tenue className="mt-1">
          Accede a los expedientes de tu despacho.
        </Tenue>
      </div>

      <FormularioAcceso destino={destino ?? '/panel'} />

      <Tenue className="text-center">
        ¿Todavía no tienes cuenta?{' '}
        <Link href="/registro" className="font-medium underline">
          Crear despacho
        </Link>
      </Tenue>
    </Foja>
  )
}

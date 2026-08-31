import type { Metadata } from 'next'
import Link from 'next/link'

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
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          Accede a los expedientes de tu despacho.
        </p>
      </div>

      <FormularioAcceso destino={destino ?? '/panel'} />

      <p className="text-center text-menor text-[var(--color-tinta-suave)]">
        ¿Todavía no tienes cuenta?{' '}
        <Link href="/registro" className="font-medium underline">
          Crear despacho
        </Link>
      </p>
    </Foja>
  )
}

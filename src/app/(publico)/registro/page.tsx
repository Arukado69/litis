import type { Metadata } from 'next'
import Link from 'next/link'

import { Tarjeta } from '@/components/ui/primitivos'

import { FormularioRegistro } from './formulario'

export const metadata: Metadata = { title: 'Crear despacho' }

export default function PaginaRegistro() {
  return (
    <Tarjeta className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Crear despacho</h1>
        <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
          Quedas como titular. Después invitas a tu equipo.
        </p>
      </div>

      <FormularioRegistro />

      <p className="text-center text-sm text-[var(--color-tinta-suave)]">
        ¿Ya tienes cuenta?{' '}
        <Link href="/acceso" className="font-medium underline">
          Entrar
        </Link>
      </p>
    </Tarjeta>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { Foja } from '@/components/ui/primitivos'

import { FormularioRegistro } from './formulario'

export const metadata: Metadata = { title: 'Crear despacho' }

export default function PaginaRegistro() {
  return (
    <Foja className="flex flex-col gap-5">
      <div>
        <h1 className="text-rotulo">Crear despacho</h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          Quedas como titular. Después invitas a tu equipo.
        </p>
      </div>

      <FormularioRegistro />

      <p className="text-center text-menor text-[var(--color-tinta-suave)]">
        ¿Ya tienes cuenta?{' '}
        <Link href="/acceso" className="font-medium underline">
          Entrar
        </Link>
      </p>
    </Foja>
  )
}

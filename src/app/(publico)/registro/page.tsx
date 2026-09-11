import type { Metadata } from 'next'
import Link from 'next/link'

import { Tenue } from '@/components/ui/composicion'
import { Foja } from '@/components/ui/primitivos'

import { FormularioRegistro } from './formulario'

export const metadata: Metadata = { title: 'Crear despacho' }

export default function PaginaRegistro() {
  return (
    <Foja className="flex flex-col gap-5">
      <div>
        <h1 className="text-rotulo">Crear despacho</h1>
        <Tenue className="mt-1">
          Quedas como titular. Después invitas a tu equipo.
        </Tenue>
      </div>

      <FormularioRegistro />

      <Tenue className="text-center">
        ¿Ya tienes cuenta?{' '}
        <Link href="/acceso" className="font-medium underline">
          Entrar
        </Link>
      </Tenue>
    </Foja>
  )
}

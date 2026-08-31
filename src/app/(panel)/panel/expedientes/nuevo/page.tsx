import type { Metadata } from 'next'
import Link from 'next/link'

import { exigirPanel } from '@/lib/auth/sesion'
import { miembrosDelDespacho } from '@/lib/expedientes/datos'

import { FormularioAlta } from './formulario'

export const metadata: Metadata = { title: 'Abrir expediente' }

export default async function PaginaNuevoExpediente() {
  const sesion = await exigirPanel()
  const miembros = await miembrosDelDespacho(sesion.activa.despachoId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/panel/expedientes"
          className="text-menor text-[var(--color-tinta-suave)] underline"
        >
          ← Expedientes
        </Link>
        <h1 className="mt-2 text-rotulo">
          Abrir expediente
        </h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          El número interno se asigna solo. Lo que falte —el número del juzgado,
          el órgano— se completa después.
        </p>
      </div>

      <FormularioAlta
        miembros={miembros.map((m) => ({
          valor: m.perfilId,
          etiqueta: m.nombre,
        }))}
      />
    </div>
  )
}

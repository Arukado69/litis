import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { miembrosDelDespacho } from '@/lib/expedientes/datos'
import { suscripcionYConsumo } from '@/lib/suscripcion/datos'
import { puedeAbrirExpediente } from '@/lib/suscripcion/limites'

import { FormularioAlta } from './formulario'

export const metadata: Metadata = { title: 'Abrir expediente' }

export default async function PaginaNuevoExpediente() {
  const sesion = await exigirPanel()
  const [miembros, { suscripcion, consumo }] = await Promise.all([
    miembrosDelDespacho(sesion.activa.despachoId),
    suscripcionYConsumo(sesion.activa.despachoId),
  ])

  // El tope se dice ANTES de llenar el formulario, no después de oprimir
  // "Abrir". Enterarse al final de que no cabe, con todo capturado, es la peor
  // forma posible de encontrarse con un límite de plan.
  const cupo = puedeAbrirExpediente(suscripcion, consumo)

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

      {cupo.permitido ? (
        cupo.aviso ? (
          <Aviso tono="informativo">{cupo.aviso}</Aviso>
        ) : null
      ) : (
        <Aviso tono="error">
          {cupo.motivo} {cupo.salida}
        </Aviso>
      )}

      <FormularioAlta
        miembros={miembros.map((m) => ({
          valor: m.perfilId,
          etiqueta: m.nombre,
        }))}
      />
    </div>
  )
}

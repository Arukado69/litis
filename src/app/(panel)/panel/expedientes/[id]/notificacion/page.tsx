import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Aviso } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { miembrosDelDespacho, obtenerExpediente } from '@/lib/expedientes/datos'
import { buscarVia } from '@/lib/expedientes/materias'
import { catalogoDeRegimen } from '@/lib/plazos/carga'
import { REGIMENES } from '@/lib/plazos/regimenes'

import { FormularioNotificacion } from './formulario'

export const metadata: Metadata = { title: 'Registrar notificación' }

export default async function PaginaNotificacion({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await exigirPanel()
  const { id } = await params

  const expediente = await obtenerExpediente(id)
  if (!expediente) notFound()

  const via = buscarVia(expediente.via)
  const regimen = via?.regimen ?? null

  const [plazos, miembros] = await Promise.all([
    regimen ? catalogoDeRegimen(regimen) : Promise.resolve([]),
    miembrosDelDespacho(sesion.activa.despachoId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/panel/expedientes/${id}`}
          className="text-sm text-[var(--color-tinta-suave)] underline"
        >
          ← {expediente.caratula}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Registrar notificación
        </h1>
        <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
          {regimen
            ? `Régimen: ${REGIMENES[regimen].nombre} · ${REGIMENES[regimen].ordenamiento}`
            : 'La vía de este expediente no está reconocida.'}
        </p>
      </div>

      {!regimen ? (
        <Aviso tono="error">
          No se puede computar un plazo sin saber qué régimen aplica. Corrige la
          vía del expediente primero.
        </Aviso>
      ) : (
        <FormularioNotificacion
          expedienteId={id}
          plazos={plazos.map((p) => ({
            valor: p.clave ?? p.id,
            etiqueta: p.verificado ? p.etiqueta : `${p.etiqueta} (sin verificar)`,
            verificado: p.verificado,
          }))}
          miembros={miembros.map((m) => ({
            valor: m.perfilId,
            etiqueta: m.nombre,
          }))}
        />
      )}
    </div>
  )
}

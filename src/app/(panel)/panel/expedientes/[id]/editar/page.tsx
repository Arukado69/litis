import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Foja, Rotulo } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { miembrosDelDespacho, obtenerExpediente } from '@/lib/expedientes/datos'
import { MATERIAS, type IdMateria } from '@/lib/expedientes/materias'
import { ROLES_POR_MATERIA, ROL_ETIQUETA, type RolParte } from '@/lib/expedientes/partes'

import { FormularioEdicion, FormularioParte } from './formulario'

export const metadata: Metadata = { title: 'Editar expediente' }

export default async function PaginaEditar({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await exigirPanel()
  const { id } = await params

  const expediente = await obtenerExpediente(id)
  if (!expediente) notFound()

  const miembros = await miembrosDelDespacho(sesion.activa.despachoId)

  // Solo las etapas del avance. Una paralela —la suspensión, un incidente— no
  // es una posición del juicio, así que ni siquiera se ofrece.
  const etapas = expediente.etapas
    .filter((e) => !e.paralela)
    .map((e) => ({ valor: e.clave, etiqueta: e.nombre }))

  const roles = (
    ROLES_POR_MATERIA[expediente.materia as IdMateria] ?? []
  ).map((r: RolParte) => ({ valor: r, etiqueta: ROL_ETIQUETA[r] }))

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <Link
          href={`/panel/expedientes/${id}`}
          className="text-menor text-[var(--color-tinta-suave)] underline decoration-[var(--color-regla-fuerte)] underline-offset-4"
        >
          Volver al expediente
        </Link>
        <h1 className="mt-2 text-rotulo">{expediente.caratula}</h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          {expediente.numeroInterno} ·{' '}
          {MATERIAS[expediente.materia as IdMateria]?.nombre ?? expediente.materia}
        </p>
      </div>

      <FormularioEdicion
        datos={{
          expedienteId: id,
          numeroOrgano: expediente.numeroOrgano ?? '',
          instancia: expediente.instancia ?? '',
          entidad: expediente.entidad ?? '',
          cuantia: expediente.cuantia === null ? '' : String(expediente.cuantia),
          responsableId: expediente.responsableId ?? '',
          restringido: expediente.restringido,
          notas: expediente.notas ?? '',
          estado: expediente.estado,
          resultado: expediente.resultado ?? '',
          fechaConclusion: expediente.fechaConclusion ?? '',
          etapaActual: expediente.etapaActual ?? '',
          etapas,
          miembros: miembros.map((m) => ({
            valor: m.perfilId,
            etiqueta: m.nombre,
          })),
          roles,
        }}
      />

      <Foja className="flex flex-col gap-4">
        <div>
          <Rotulo>Agregar una parte</Rotulo>
          <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
            Un tercero llamado a juicio o un codemandado que apareció en la
            contestación. Se vuelve a correr el cotejo de conflicto de interés:
            quien entra a mitad del juicio puede ser cliente del despacho en
            otro asunto.
          </p>
        </div>
        <FormularioParte expedienteId={id} roles={roles} />
      </Foja>

      {/* Lo que NO se edita, dicho en voz alta en vez de dejar al usuario
          buscándolo. */}
      <p className="text-nota text-[var(--color-tinta-suave)]">
        La materia, la vía y el fuero no se editan: de la vía sale el régimen
        con el que ya se computaron los plazos de este expediente, y cambiarla
        en caliente dejaría fechas calculadas con una regla y un expediente que
        dice otra. Si se capturó mal, se cierra este asunto y se abre el
        correcto.
      </p>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Aviso, Boton, Tarjeta } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { obtenerExpediente, plazosDelExpediente } from '@/lib/expedientes/datos'
import { avance } from '@/lib/expedientes/etapas'
import {
  buscarVia,
  FUERO_ETIQUETA,
  MATERIAS,
  type Fuero,
  type IdMateria,
} from '@/lib/expedientes/materias'
import { ROL_ETIQUETA, type RolParte } from '@/lib/expedientes/partes'
import { fechaLarga, fechaLargaConDia } from '@/lib/plazos/fecha'

export const metadata: Metadata = { title: 'Expediente' }

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[var(--color-tinta-suave)]">
        {etiqueta}
      </dt>
      <dd className="mt-0.5">{valor ?? '—'}</dd>
    </div>
  )
}

export default async function PaginaExpediente({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await exigirPanel()
  const { id } = await params
  const [expediente, plazos] = await Promise.all([
    obtenerExpediente(id),
    plazosDelExpediente(id),
  ])

  // `obtenerExpediente` no distingue "no existe" de "no tienes acceso", y aquí
  // tampoco: decirle a alguien que el expediente existe pero no puede verlo ya
  // es filtrar la existencia de un asunto ajeno.
  if (!expediente) notFound()

  const via = buscarVia(expediente.via)
  const progreso = Math.round(avance(expediente.via, expediente.etapaActual ?? '') * 100)
  const etapaActual = expediente.etapas.find(
    (e) => e.clave === expediente.etapaActual,
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/panel/expedientes"
          className="text-sm text-[var(--color-tinta-suave)] underline"
        >
          ← Expedientes
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {expediente.caratula}
            </h1>
            <span className="text-sm text-[var(--color-tinta-suave)]">
              {expediente.numeroInterno}
              {expediente.numeroOrgano ? ` · ${expediente.numeroOrgano}` : ''}
            </span>
          </div>
          <Link href={`/panel/expedientes/${id}/notificacion`}>
            <Boton>Registrar notificación</Boton>
          </Link>
        </div>
      </div>

      <Tarjeta>
        <h2 className="mb-4 font-medium">Plazos</h2>
        {plazos.length === 0 ? (
          <p className="text-sm text-[var(--color-tinta-suave)]">
            Ninguno todavía. Registra una notificación y el sistema computa su
            plazo con la traza a la vista.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {plazos.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-[var(--color-borde)] p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{p.etiqueta}</span>
                  <span>Vence el {fechaLargaConDia(p.fechaVencimiento)}</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-tinta-suave)]">
                  Notificado el {fechaLarga(p.fechaNotificacion)}
                  {p.responsableNombre ? ` · ${p.responsableNombre}` : ''}
                  {p.confiabilidad === 'semilla_no_verificada'
                    ? ' · cómputo sin verificar'
                    : ''}
                </p>
                {/* Un vencimiento corregido a mano tiene que decir que lo fue,
                    y por qué: si no, la fecha aparenta salir del motor. */}
                {p.ajustada ? (
                  <p className="mt-1 text-xs text-[var(--color-proximo)]">
                    Fecha ajustada a mano — {p.motivoAjuste}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {expediente.restringido ? (
        <Aviso tono="informativo">
          Asunto restringido: solo el responsable, el titular y quien tenga
          acceso expreso pueden abrirlo.
        </Aviso>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Tarjeta className="lg:col-span-2">
          <h2 className="mb-4 font-medium">El asunto</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Dato
              etiqueta="Materia"
              valor={MATERIAS[expediente.materia as IdMateria]?.nombre ?? expediente.materia}
            />
            <Dato etiqueta="Vía" valor={via?.nombre ?? expediente.via} />
            <Dato
              etiqueta="Fuero"
              valor={FUERO_ETIQUETA[expediente.fuero as Fuero] ?? expediente.fuero}
            />
            <Dato etiqueta="Entidad" valor={expediente.entidad} />
            <Dato etiqueta="Instancia" valor={expediente.instancia} />
            <Dato
              etiqueta="Cuantía"
              valor={
                expediente.cuantia === null
                  ? null
                  : expediente.cuantia.toLocaleString('es-MX', {
                      style: 'currency',
                      currency: 'MXN',
                    })
              }
            />
            <Dato etiqueta="Responsable" valor={expediente.responsableNombre} />
            <Dato
              etiqueta="Inicio"
              valor={expediente.fechaInicio ? fechaLarga(expediente.fechaInicio) : null}
            />
          </dl>

          {expediente.notas ? (
            <p className="mt-4 border-t border-[var(--color-borde)] pt-4 text-sm text-[var(--color-tinta-suave)]">
              {expediente.notas}
            </p>
          ) : null}
        </Tarjeta>

        <Tarjeta>
          <h2 className="mb-4 font-medium">Partes</h2>
          <ul className="flex flex-col gap-3 text-sm">
            {expediente.partes.map((p) => (
              <li key={p.id}>
                <div className="font-medium">
                  {p.nombre}
                  {p.esNuestraParte ? (
                    <span className="ml-2 rounded bg-[var(--color-papel)] px-1.5 py-0.5 text-xs font-normal text-[var(--color-tinta-suave)]">
                      nuestra parte
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-[var(--color-tinta-suave)]">
                  {ROL_ETIQUETA[p.rol as RolParte] ?? p.rol}
                  {p.abogadoContrario ? ` · Abogado: ${p.abogadoContrario}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </div>

      <Tarjeta>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-medium">Etapas</h2>
          <span className="text-sm text-[var(--color-tinta-suave)]">
            {etapaActual ? etapaActual.nombre : 'Sin etapa'} · {progreso}%
          </span>
        </div>

        <ol className="flex flex-col gap-2 text-sm">
          {expediente.etapas.map((e) => {
            const esActual = e.clave === expediente.etapaActual
            return (
              <li
                key={e.clave}
                className={
                  esActual
                    ? 'rounded-md border border-[var(--color-acento)] bg-[var(--color-papel)] p-3'
                    : 'rounded-md border border-[var(--color-borde)] p-3'
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className={esActual ? 'font-medium' : ''}>
                    {e.nombre}
                  </span>
                  {/* Una etapa paralela no es una posición del avance: el
                      asunto no "está en" la suspensión, la tiene. */}
                  {e.paralela ? (
                    <span className="text-xs text-[var(--color-tinta-suave)]">
                      en paralelo
                    </span>
                  ) : null}
                </div>
                {e.descripcion ? (
                  <p className="mt-1 text-xs text-[var(--color-tinta-suave)]">
                    {e.descripcion}
                  </p>
                ) : null}
              </li>
            )
          })}
        </ol>
      </Tarjeta>

    </div>
  )
}

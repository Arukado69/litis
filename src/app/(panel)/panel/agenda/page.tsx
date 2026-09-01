import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Foja, Sello } from '@/components/ui/primitivos'
import {
  armarAgenda,
  diasImposibles,
  habilesEnAgenda,
  type DiaDeAgenda,
} from '@/lib/audiencias/agenda'
import {
  audienciasDelDespacho,
  vencimientosDelDespacho,
} from '@/lib/audiencias/datos'
import { exigirPanel } from '@/lib/auth/sesion'
import { cargarCalendarioPorClave } from '@/lib/plazos/carga'
import { fechaLargaConDia, hoyEnMexico } from '@/lib/plazos/fecha'

export const metadata: Metadata = { title: 'Agenda' }

function Dia({ dia }: { dia: DiaDeAgenda }) {
  const vacio = dia.audiencias.length === 0 && dia.vencimientos.length === 0

  return (
    <li
      className={`grid grid-cols-[9rem_1fr] gap-4 border-t border-[var(--color-regla)] py-3 ${
        dia.inhabil ? 'bg-[var(--color-tenue)]' : ''
      }`}
    >
      <div className="pl-1">
        <p
          className={
            dia.esHoy
              ? 'font-medium text-[var(--color-sello)]'
              : dia.inhabil
                ? 'text-[var(--color-tinta-suave)]'
                : 'font-medium'
          }
        >
          {fechaLargaConDia(dia.fecha).replace(/ de \d{4}$/, '')}
        </p>
        {dia.esHoy ? (
          <p className="text-nota text-[var(--color-sello)]">hoy</p>
        ) : dia.inhabil ? (
          <p className="text-nota text-[var(--color-tinta-suave)]">
            {dia.motivoInhabil}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        {vacio ? (
          <p className="text-menor text-[var(--color-regla-fuerte)]">—</p>
        ) : null}

        {dia.audiencias.map((a) => (
          <div
            key={a.id}
            className="margen bg-[var(--color-foja)] py-2 pl-3 pr-2"
            data-urgencia="inminente"
          >
            <p className="font-medium">
              {a.hora ? `${a.hora} · ` : ''}
              {a.tipo}
            </p>
            <p className="text-menor text-[var(--color-tinta-suave)]">
              <Link
                href={`/panel/expedientes/${a.expedienteId}`}
                className="underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)]"
              >
                {a.numeroExpediente} · {a.caratula}
              </Link>
              {a.lugar ? ` · ${a.lugar}` : ''}
            </p>
            <p className="text-nota text-[var(--color-tinta-suave)]">
              {a.responsableNombre ?? (
                <span className="font-medium text-[var(--color-urgente)]">
                  Nadie asignado
                </span>
              )}
            </p>
          </div>
        ))}

        {dia.vencimientos.map((v) => (
          <div key={v.id} className="border-l-2 border-[var(--color-regla-fuerte)] py-1 pl-3">
            <p className="text-menor">
              Vence: {v.etiqueta}
              {dia.tomado ? (
                <span className="ml-2 align-middle">
                  {/* El aviso que importa: ese día ya está tomado. */}
                  <Sello tono="urgente">cae en día de audiencia</Sello>
                </span>
              ) : null}
            </p>
            <p className="text-nota text-[var(--color-tinta-suave)]">
              <Link
                href={`/panel/expedientes/${v.expedienteId}`}
                className="underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)]"
              >
                {v.numeroExpediente} · {v.caratula}
              </Link>
              {v.responsableNombre ? ` · ${v.responsableNombre}` : ''}
            </p>
          </div>
        ))}
      </div>
    </li>
  )
}

export default async function PaginaAgenda() {
  const sesion = await exigirPanel()
  const hoy = hoyEnMexico()
  const despachoId = sesion.activa.despachoId

  const [audiencias, vencimientos, calendario] = await Promise.all([
    audienciasDelDespacho(despachoId),
    vencimientosDelDespacho(despachoId),
    cargarCalendarioPorClave('pjf-2026'),
  ])

  if (!calendario) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-portada">Agenda</h1>
        <Aviso tono="error">
          No hay calendarios de días inhábiles cargados, así que la agenda no
          puede marcar qué días son de trabajo. Aplica la migración de semilla.
        </Aviso>
      </div>
    )
  }

  const dias = armarAgenda({ audiencias, vencimientos, hoy, calendario })
  const imposibles = diasImposibles(dias)
  const habiles = habilesEnAgenda(dias)
  const cuantasAudiencias = dias.reduce((n, d) => n + d.audiencias.length, 0)

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <p className="text-menor text-[var(--color-tinta-suave)]">
          {fechaLargaConDia(hoy)}
        </p>
        <h1 className="mt-0.5 text-portada">Agenda</h1>
        <p className="mt-2 max-w-prose text-menor text-[var(--color-tinta-suave)]">
          Las próximas cuatro semanas: {dias.length} días naturales,{' '}
          <strong className="font-semibold text-[var(--color-tinta)]">
            {habiles} hábiles
          </strong>
          , con {cuantasAudiencias}{' '}
          {cuantasAudiencias === 1 ? 'audiencia' : 'audiencias'}. Los
          vencimientos van en la misma lista a propósito: compiten por el mismo
          día.
        </p>
      </div>

      {/* Arriba de todo, como en el panel: solo sirve descubrirlo con tiempo. */}
      {imposibles.length > 0 ? (
        <Foja className="border-[var(--color-urgente)]/40">
          <h2 className="text-guia text-[var(--color-urgente)]">Días imposibles</h2>
          <ul className="mt-3 flex flex-col gap-2 text-menor">
            {imposibles.map((d) => (
              <li key={`${d.fecha}-${d.responsableNombre}`}>
                <span className="font-medium">{d.responsableNombre}</span>,{' '}
                {fechaLargaConDia(d.fecha)}:{' '}
                {d.audiencias > 1
                  ? `${d.audiencias} audiencias el mismo día`
                  : `audiencia y ${d.vencimientos} ${d.vencimientos === 1 ? 'vencimiento' : 'vencimientos'}`}
                .
              </li>
            ))}
          </ul>
          <p className="mt-3 text-nota text-[var(--color-tinta-suave)]">
            Una audiencia no se mueve y se lleva la jornada entre traslado,
            espera y desahogo. Lo que venza ese día hay que trabajarlo antes.
          </p>
        </Foja>
      ) : null}

      <ul className="border-b border-[var(--color-regla)]">
        {dias.map((d) => (
          <Dia key={d.fecha} dia={d} />
        ))}
      </ul>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Tenue } from '@/components/ui/composicion'
import { Foja, Rotulo, Sello } from '@/components/ui/primitivos'
import { exigirPortal } from '@/lib/auth/sesion'
import { TIPO_DOCUMENTO_ETIQUETA } from '@/lib/documentos/archivos'
import {
  asuntoDelCliente,
  audienciasVisibles,
  documentosVisibles,
  movimientosVisibles,
} from '@/lib/portal/datos'
import { AVISO_PORTAL, faseEnLlano, ultimoMovimiento } from '@/lib/portal/lenguaje'
import { fechaLarga, fechaLargaConDia, hoyEnMexico } from '@/lib/plazos/fecha'
import type { TipoDocumento } from '@/types/db'

export const metadata: Metadata = { title: 'Mi asunto' }

export default async function PaginaAsunto({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await exigirPortal()
  const { id } = await params
  const personaId = sesion.activa.personaId
  if (!personaId) notFound()

  // `asuntoDelCliente` solo devuelve los de ESTA persona: pedir el id de otro
  // cliente del mismo despacho da 404, igual que si no existiera.
  const asunto = await asuntoDelCliente(sesion.activa.despachoId, personaId, id)
  if (!asunto) notFound()

  const [audiencias, movimientos, documentos] = await Promise.all([
    audienciasVisibles(id),
    movimientosVisibles(id),
    documentosVisibles(id),
  ])

  const hoy = hoyEnMexico()
  const llano = faseEnLlano(asunto.via, asunto.etapaClave)

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <Link
          href="/portal"
          className="text-menor text-[var(--color-tinta-suave)] underline decoration-[var(--color-regla-fuerte)] underline-offset-4"
        >
          Volver a mis asuntos
        </Link>
        <h1 className="mt-2 text-rotulo">{asunto.caratula}</h1>
        <Tenue className="mt-1 flex flex-wrap items-center gap-2">
          {asunto.numeroOrgano ? <span>{asunto.numeroOrgano}</span> : null}
          {asunto.estado === 'suspendido' ? (
            <Sello tono="neutro">suspendido</Sello>
          ) : null}
        </Tenue>
      </div>

      {/* En qué va, en palabras. Sin fechas de terminación y sin pronósticos:
          un litigante no puede saber cuándo termina un juicio. */}
      <Foja className="border-l-2 border-l-[var(--color-sello)]">
        <p className="text-guia font-medium">{llano.titulo}</p>
        <p className="mt-2 max-w-prose">{llano.queSignifica}</p>
        <Tenue className="mt-2 max-w-prose">
          {llano.queSigue}
        </Tenue>
        <Tenue tamano="nota" className="mt-3 border-t border-[var(--color-regla)] pt-3">
          {ultimoMovimiento(asunto.ultimoMovimientoEl, hoy)}
          {asunto.responsableNombre
            ? ` · Lleva tu asunto: ${asunto.responsableNombre}`
            : ''}
        </Tenue>
      </Foja>

      {audiencias.length > 0 ? (
        <Foja>
          <Rotulo>Tus próximas audiencias</Rotulo>
          <ul className="mt-3 flex flex-col gap-3">
            {audiencias.map((a) => (
              <li key={a.id} className="border-l-2 border-[var(--color-proximo)] pl-4">
                <p className="font-medium">
                  {fechaLargaConDia(a.fecha)}
                  {a.hora ? `, ${a.hora}` : ''}
                </p>
                <Tenue>
                  {a.tipo}
                  {a.lugar ? ` · ${a.lugar}` : ''}
                </Tenue>
              </li>
            ))}
          </ul>
          <Tenue tamano="nota" className="mt-3">
            Las audiencias las señala el juzgado y a veces se difieren. Si
            cambia alguna, aparece aquí.
          </Tenue>
        </Foja>
      ) : null}

      {documentos.length > 0 ? (
        <Foja>
          <Rotulo>Documentos que compartió tu abogado</Rotulo>
          <ul className="mt-3 flex flex-col gap-2 text-menor">
            {documentos.map((d) => (
              <li key={d.id} className="border-l-2 border-[var(--color-regla)] pl-4">
                <p className="font-medium">{d.nombre}</p>
                <Tenue tamano="nota">
                  {TIPO_DOCUMENTO_ETIQUETA[d.tipo as TipoDocumento] ?? d.tipo} ·{' '}
                  {fechaLarga(d.creadoEl.slice(0, 10))}
                </Tenue>
              </li>
            ))}
          </ul>
          <Tenue tamano="nota" className="mt-3">
            Para recibir una copia, pídesela a tu abogado.
          </Tenue>
        </Foja>
      ) : null}

      <Foja>
        <Rotulo>Qué ha pasado</Rotulo>
        {movimientos.length === 0 ? (
          <Tenue className="mt-3">
            Todavía no hay movimientos que compartir. No quiere decir que no
            esté pasando nada: quiere decir que aún no hay un hecho del juzgado
            que reportar.
          </Tenue>
        ) : (
          <ol className="mt-3 flex flex-col">
            {movimientos.map((m) => (
              <li
                key={m.id}
                className="border-l-2 border-[var(--color-regla)] py-2.5 pl-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-medium">{m.titulo}</p>
                  <Tenue>
                    {fechaLarga(m.fecha)}
                  </Tenue>
                </div>
                {m.detalle ? (
                  <Tenue className="mt-1 max-w-prose whitespace-pre-line">
                    {m.detalle}
                  </Tenue>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Foja>

      <Tenue tamano="nota" className="max-w-prose border-t border-[var(--color-regla)] pt-4">
        {AVISO_PORTAL}
      </Tenue>
    </div>
  )
}

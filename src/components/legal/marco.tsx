import type { ReactNode } from 'react'

import { Aviso } from '@/components/ui/primitivos'
import { VIGENCIA, datosPendientes, esBorrador } from '@/lib/legal/responsable'
import { fechaLarga } from '@/lib/plazos/fecha'

/**
 * El marco de un documento legal.
 *
 * La banda de borrador **no es decoración defensiva**: mientras falten la razón
 * social, el domicilio o el correo para ejercer derechos ARCO, este documento
 * no cumple lo que la ley pide de él, y quien lo lea tiene que saberlo antes de
 * confiar en él. Desaparece sola en cuanto se llenen los datos
 * (`src/lib/legal/responsable.ts`).
 */
export function Documento({
  titulo,
  entrada,
  children,
}: {
  titulo: string
  entrada: string
  children: ReactNode
}) {
  const pendientes = datosPendientes()

  return (
    <article className="flex flex-col gap-8">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-5">
        <h1 className="text-portada">{titulo}</h1>
        <p className="mt-2 max-w-prose text-menor text-[var(--color-tinta-suave)]">
          {entrada}
        </p>
        <p className="mt-3 text-nota text-[var(--color-tinta-suave)]">
          Última actualización: {fechaLarga(VIGENCIA)}.
        </p>
      </div>

      {esBorrador() ? (
        <Aviso tono="error">
          <strong className="font-medium">
            Este documento es un borrador y todavía no se puede tomar como
            vigente.
          </strong>{' '}
          Falta{pendientes.length === 1 ? '' : 'n'} {listar(pendientes)}. Además,
          el texto lo tiene que revisar quien responda por él antes de
          publicarse: describe con exactitud qué hace el sistema, pero eso no lo
          vuelve un documento legal revisado.
        </Aviso>
      ) : null}

      <div className="flex flex-col gap-8">{children}</div>
    </article>
  )
}

function listar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? ''
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

/** `Cómo se ejercen los derechos` → `como-se-ejercen-los-derechos` */
function ancla(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Una cláusula, numerada y con ancla propia.
 *
 * El número no es adorno: sirve para poder decir "la cláusula 7" en un correo,
 * y el ancla para poder mandar el enlace exacto en vez de "búscalo por ahí".
 */
export function Clausula({
  numero,
  titulo,
  children,
}: {
  numero: number
  titulo: string
  children: ReactNode
}) {
  const id = ancla(titulo)

  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-guia">
        <span className="mr-2 font-obra text-menor font-normal text-[var(--color-tinta-suave)] tabular-nums">
          {numero}
        </span>
        {titulo}
      </h2>
      {/* El texto se lee a ancho de prosa, pero las tablas NO: encerrar una
          tabla de cuatro columnas en 65 caracteres la deja con una columna
          cortada y un scroll horizontal que nadie ve. Se limita el ancho de los
          párrafos y las listas; lo demás usa la columna completa. */}
      <div className="mt-2 flex flex-col gap-3 text-menor [&>p]:max-w-prose [&>ul]:max-w-prose">
        {children}
      </div>
    </section>
  )
}

/** Una lista dentro de una cláusula. */
export function Puntos({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-1.5 border-l border-[var(--color-regla)] pl-4">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  )
}

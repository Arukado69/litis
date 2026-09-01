import type { Metadata } from 'next'
import Link from 'next/link'

import {
  Cierre,
  ElProblema,
  LaTraza,
  NoFingeCerteza,
  Precios,
  QueHace,
} from '@/components/marketing/secciones'
import { Boton, CintaDias } from '@/components/ui/primitivos'
import { MARCA } from '@/lib/brand'
import { tramoDeDias } from '@/lib/plazos/calendario'
import { CALENDARIO_PJF_2026 } from '@/lib/plazos/calendarios-semilla'

/**
 * La portada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ENCABEZADO NO EXPLICA EL PRODUCTO: LO ENSEÑA
 * ─────────────────────────────────────────────────────────────────────────────
 * La cinta que se pinta arriba sale del **motor de verdad** —`tramoDeDias`
 * sobre el calendario del PJF 2026, el mismo que corre dentro del panel—, no de
 * un dibujo. Entre el 15 de julio y el 3 de agosto de 2026 hay veinte días
 * naturales y dos hábiles, porque en medio el órgano está de vacaciones.
 *
 * Ese hueco es todo el argumento del producto y se entiende antes de leer una
 * sola frase. Y si algún día el calendario se corrige, la portada se corrige
 * sola: no hay forma de que la promesa y el motor se separen.
 */

export const metadata: Metadata = {
  title: `${MARCA.nombre} — plazos procesales para litigantes`,
  description: MARCA.descripcionCorta,
}

const DESDE = '2026-07-15'
const HASTA = '2026-08-03'

export default function Inicio() {
  const tramo = tramoDeDias(DESDE, HASTA, CALENDARIO_PJF_2026)
  const habiles = tramo.filter((d) => d.habil).length

  return (
    <>
      <header className="border-b border-[var(--color-regla)] bg-[var(--color-foja)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <span className="font-titulo text-guia font-semibold tracking-tight">
            {MARCA.nombre}
          </span>
          <nav className="flex items-center gap-5 text-menor">
            <Link
              href="#precios"
              className="text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)]"
            >
              Precios
            </Link>
            <Link
              href="/acceso"
              className="text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)]"
            >
              Entrar
            </Link>
            <Link href="/registro">
              <Boton>Crear despacho</Boton>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-12 px-6 py-16">
        <div>
          <p className="text-menor text-[var(--color-tinta-suave)]">
            Un término de veinte días, del 15 de julio al 3 de agosto de 2026
          </p>

          <div className="mt-5 overflow-x-auto pb-1">
            <CintaDias
              dias={tramo}
              tamano="grande"
              descripcion={`${tramo.length} días naturales, ${habiles} hábiles.`}
            />
          </div>

          <p className="mt-5 max-w-prose text-guia">
            {tramo.length} días naturales.{' '}
            <strong className="font-semibold text-[var(--color-urgente)]">
              {habiles} hábiles.
            </strong>{' '}
            El órgano está de vacaciones en medio, y quien cuente los veinte
            presenta fuera de término.
          </p>

          <p className="mt-2 text-menor text-[var(--color-tinta-suave)]">
            Cada casilla es un día: llena si es hábil, vacía si no. La última es
            el vencimiento.
          </p>
        </div>

        <div className="border-t border-[var(--color-regla-fuerte)] pt-10">
          <h1 className="max-w-prose text-portada">
            Los plazos de tu despacho, computados con su fundamento a la vista.
          </h1>
          <p className="mt-3 max-w-prose text-[var(--color-tinta-suave)]">
            {MARCA.descripcionLarga} Para litigantes en México, con los
            calendarios y los regímenes de cómputo que de verdad se aplican
            aquí.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/registro">
              <Boton>Empezar gratis</Boton>
            </Link>
            <Link href="#precios">
              <Boton variante="secundario">Ver precios</Boton>
            </Link>
          </div>
        </div>

        <ElProblema />
        <LaTraza />
        <QueHace />
        <NoFingeCerteza />
        <Precios />
        <Cierre />

        <footer className="border-t border-[var(--color-regla)] pt-6">
          <p className="max-w-prose text-nota text-[var(--color-tinta-suave)]">
            {MARCA.nombre} es una herramienta de control interno. No es asesoría
            jurídica y no emite dictámenes: los cómputos son sugerencias que el
            abogado verifica contra el ordenamiento aplicable y el calendario del
            órgano. La responsabilidad profesional del término es de quien firma
            la promoción.
          </p>
        </footer>
      </main>
    </>
  )
}

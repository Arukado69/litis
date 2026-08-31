import Link from 'next/link'

import { Boton, CintaDias } from '@/components/ui/primitivos'
import { MARCA } from '@/lib/brand'
import { tramoDeDias } from '@/lib/plazos/calendario'
import { CALENDARIO_PJF_2026 } from '@/lib/plazos/calendarios-semilla'

/**
 * La portada.
 *
 * El encabezado NO explica el producto: lo enseña. La cinta que se pinta
 * arriba sale del **motor de verdad** —`tramoDeDias` sobre el calendario del
 * PJF 2026, el mismo que corre dentro del panel—, no de un dibujo. Entre el 15
 * de julio y el 3 de agosto de 2026 hay veinte días naturales y dos hábiles,
 * porque en medio el órgano está de vacaciones.
 *
 * Ese hueco es todo el argumento del producto, y se entiende antes de leer una
 * sola frase. Si algún día el calendario se corrige, la portada se corrige
 * sola: no hay forma de que la promesa y el motor se separen.
 */

const DESDE = '2026-07-15'
const HASTA = '2026-08-03'

export default function Inicio() {
  const tramo = tramoDeDias(DESDE, HASTA, CALENDARIO_PJF_2026)
  const habiles = tramo.filter((d) => d.habil).length

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-10 px-6 py-20">
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

      <div className="border-t border-[var(--color-regla-fuerte)] pt-8">
        <h1 className="text-portada">{MARCA.nombre}</h1>
        <p className="mt-3 max-w-prose text-[var(--color-tinta-suave)]">
          {MARCA.descripcionLarga}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/acceso">
            <Boton>Entrar</Boton>
          </Link>
          <Link href="/registro">
            <Boton variante="secundario">Crear despacho</Boton>
          </Link>
        </div>
      </div>

      <p className="max-w-prose text-menor text-[var(--color-tinta-suave)]">
        Litis es una herramienta de control interno. No es asesoría jurídica y
        no emite dictámenes: los cómputos son sugerencias que el abogado
        verifica contra el ordenamiento aplicable y el calendario del órgano.
      </p>
    </main>
  )
}

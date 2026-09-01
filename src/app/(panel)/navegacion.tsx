'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const RUTAS = [
  { href: '/panel', etiqueta: 'Qué vence', exacta: true },
  { href: '/panel/agenda', etiqueta: 'Agenda', exacta: false },
  { href: '/panel/tablero', etiqueta: 'Tablero', exacta: false },
  { href: '/panel/expedientes', etiqueta: 'Expedientes', exacta: false },
  { href: '/panel/catalogo', etiqueta: 'Catálogo', exacta: false },
  { href: '/panel/equipo', etiqueta: 'Equipo', exacta: false },
] as const

/**
 * La navegación del panel, con la sección activa marcada.
 *
 * El subrayado grueso en violeta de sello es la única marca: dos secciones no
 * necesitan pestañas ni fondos: necesitan que se sepa en cuál estás.
 */
export function Navegacion() {
  const ruta = usePathname()

  return (
    <nav className="flex gap-5 text-menor">
      {RUTAS.map((r) => {
        const activa = r.exacta ? ruta === r.href : ruta.startsWith(r.href)
        return (
          <Link
            key={r.href}
            href={r.href}
            aria-current={activa ? 'page' : undefined}
            className={
              activa
                ? 'border-b-2 border-[var(--color-sello)] pb-0.5 font-medium'
                : 'border-b-2 border-transparent pb-0.5 text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)]'
            }
          >
            {r.etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

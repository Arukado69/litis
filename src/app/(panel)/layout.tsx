import Link from 'next/link'

import { cerrarSesion } from '@/app/(publico)/acceso/acciones'
import { Boton } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { MARCA } from '@/lib/brand'
import type { RolMembresia } from '@/types/db'

const ROL_ETIQUETA: Record<RolMembresia, string> = {
  titular: 'Titular',
  abogado: 'Abogado',
  pasante: 'Pasante',
  asistente: 'Asistente',
  cliente: 'Cliente',
}

/**
 * Marco del panel interno. Segunda capa de seguridad: `exigirPanel` decide si
 * esta persona ve estas pantallas. La tercera —qué filas puede leer— la sigue
 * decidiendo la RLS.
 */
export default async function LayoutPanel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-borde)] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/panel" className="font-semibold tracking-tight">
              {MARCA.nombre}
            </Link>
            <span className="text-sm text-[var(--color-tinta-suave)]">
              {sesion.activa.despachoNombre}
            </span>
          </div>

          <nav className="flex gap-4 text-sm">
            <Link href="/panel" className="hover:underline">
              Qué vence
            </Link>
            <Link href="/panel/expedientes" className="hover:underline">
              Expedientes
            </Link>
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-tinta-suave)]">
              {sesion.nombre || sesion.correo} ·{' '}
              {ROL_ETIQUETA[sesion.activa.rol]}
            </span>
            <form action={cerrarSesion}>
              <Boton variante="fantasma" type="submit" className="px-2 py-1">
                Salir
              </Boton>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  )
}

import Link from 'next/link'

import { cerrarSesion } from '@/app/(publico)/acceso/acciones'
import { Boton } from '@/components/ui/primitivos'
import { exigirPortal } from '@/lib/auth/sesion'
import { MARCA } from '@/lib/brand'

/**
 * Marco del portal del cliente.
 *
 * Segunda capa de seguridad: `exigirPortal` deja pasar solo a quien tiene
 * membresía de cliente. La tercera —qué expedientes— la decide la RLS, que
 * limita al cliente a aquellos donde su persona del padrón es el cliente.
 *
 * Deliberadamente más sobrio que el panel: aquí no hay navegación entre
 * secciones porque no hay secciones. Un cliente tiene uno, dos o tres asuntos
 * y entra a ver uno.
 */
export default async function LayoutPortal({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPortal()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-regla)] bg-[var(--color-foja)]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5">
          <Link
            href="/portal"
            className="font-titulo text-guia font-semibold tracking-tight"
          >
            {MARCA.nombre}
          </Link>
          <span className="text-menor text-[var(--color-tinta-suave)]">
            {sesion.activa.despachoNombre}
          </span>

          <div className="ml-auto flex items-center gap-3 text-nota text-[var(--color-tinta-suave)]">
            <span>{sesion.nombre || sesion.correo}</span>
            <form action={cerrarSesion}>
              <Boton variante="fantasma" type="submit" className="px-0 py-0">
                Salir
              </Boton>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  )
}

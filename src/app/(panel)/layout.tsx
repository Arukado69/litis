import Link from 'next/link'

import { cerrarSesion } from '@/app/(publico)/acceso/acciones'
import { Boton } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { MARCA } from '@/lib/brand'
import type { RolMembresia } from '@/types/db'

import { Navegacion } from './navegacion'

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
 *
 * La barra es de una sola línea a propósito: en una laptop de trece pulgadas
 * cada franja de cromo fija es un renglón menos de expediente.
 */
export default async function LayoutPanel({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sesion = await exigirPanel()

  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-regla)] bg-[var(--color-foja)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-2.5">
          <Link
            href="/panel"
            className="font-titulo text-guia font-semibold tracking-tight"
          >
            {MARCA.nombre}
          </Link>

          <Navegacion />

          <div className="ml-auto flex items-center gap-3 text-nota text-[var(--color-tinta-suave)]">
            <span>
              {sesion.activa.despachoNombre} · {sesion.nombre || sesion.correo} (
              {ROL_ETIQUETA[sesion.activa.rol]})
            </span>
            {/* La suscripción no es trabajo diario: va aquí, junto al nombre
                del despacho, y no en la navegación de secciones. Solo el
                titular contrata, así que a los demás ni se les enseña. */}
            {sesion.activa.rol === 'titular' ? (
              <Link
                href="/panel/suscripcion"
                className="underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)]"
              >
                Suscripción
              </Link>
            ) : null}
            <form action={cerrarSesion}>
              <Boton variante="fantasma" type="submit" className="px-0 py-0">
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

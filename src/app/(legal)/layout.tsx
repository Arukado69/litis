import Link from 'next/link'

import { MARCA } from '@/lib/brand'

/**
 * Marco de los documentos legales.
 *
 * Ancho de lectura y nada más: aquí no hay nada que hacer más que leer. Los dos
 * documentos se enlazan entre sí abajo porque quien llega a uno casi siempre
 * necesita el otro, y porque Stripe pide las dos direcciones para dejar abrir
 * el portal de facturación.
 */
export default function LayoutLegal({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-[var(--color-regla)] bg-[var(--color-foja)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-3">
          <Link
            href="/"
            className="font-titulo text-guia font-semibold tracking-tight"
          >
            {MARCA.nombre}
          </Link>
          <Link
            href="/"
            className="text-menor text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)]"
          >
            Volver al inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>

      <footer className="mx-auto max-w-3xl px-6 pb-12">
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--color-regla)] pt-5 text-nota">
          <Link href="/aviso-de-privacidad" className="underline underline-offset-4">
            Aviso de privacidad
          </Link>
          <Link
            href="/terminos-y-condiciones"
            className="underline underline-offset-4"
          >
            Términos y condiciones
          </Link>
        </div>
      </footer>
    </div>
  )
}

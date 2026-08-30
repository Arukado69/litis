import Link from 'next/link'

import { MARCA } from '@/lib/brand'

/**
 * Marco de las pantallas de acceso. Sobrio a propósito: quien entra aquí ya
 * decidió usar la herramienta y lo único que quiere es pasar.
 */
export default function LayoutPublico({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-lg font-semibold tracking-tight"
        >
          {MARCA.nombre}
        </Link>
        {children}
      </div>
    </div>
  )
}

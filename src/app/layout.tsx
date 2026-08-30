import type { Metadata } from 'next'

import { MARCA, titulo } from '@/lib/brand'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: titulo(),
    template: `%s · ${MARCA.sufijoTitulo}`,
  },
  description: MARCA.descripcionCorta,
  // Todavía no hay nada público que indexar.
  robots: { index: false, follow: false },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="antialiased">{children}</body>
    </html>
  )
}

import { MARCA } from '@/lib/brand'

/**
 * Marcador de posición honesto.
 *
 * El núcleo de dominio está construido y probado; la interfaz no. Esta página
 * lo dice en vez de fingir un producto terminado — la primera pantalla real
 * será el acceso, en la rebanada R1 del roadmap.
 */
export default function Inicio() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{MARCA.nombre}</h1>
        <p className="mt-2 text-[var(--color-tinta-suave)]">
          {MARCA.descripcionLarga}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-borde)] bg-white p-5">
        <p className="text-sm font-medium">En construcción</p>
        <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
          El núcleo de dominio —cómputo de plazos, calendarios, expedientes y
          detección de conflicto de interés— está construido y probado. La
          interfaz todavía no. El plan está en <code>docs/ROADMAP.md</code>.
        </p>
      </div>
    </main>
  )
}

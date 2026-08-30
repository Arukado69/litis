import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Primitivos de interfaz. Sistema propio, no una librería de componentes.
 *
 * Son pocos a propósito: un despacho necesita leer datos densos —fechas,
 * números de expediente, carátulas— no animaciones. Todo lo que se agregue
 * aquí tiene que ganarse el lugar.
 */

export function Tarjeta({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--color-borde)] bg-white p-5',
        className,
      )}
      {...props}
    />
  )
}

type VarianteBoton = 'primario' | 'secundario' | 'fantasma'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario:
    'bg-[var(--color-tinta)] text-white hover:bg-[var(--color-tinta-suave)]',
  secundario:
    'border border-[var(--color-borde)] bg-white text-[var(--color-tinta)] hover:bg-[var(--color-papel)]',
  fantasma:
    'text-[var(--color-tinta-suave)] hover:text-[var(--color-tinta)] hover:underline',
}

export function Boton({
  variante = 'primario',
  className,
  ...props
}: ComponentProps<'button'> & { variante?: VarianteBoton }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-acento)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        ESTILO_BOTON[variante],
        className,
      )}
      {...props}
    />
  )
}

/**
 * Campo de formulario con etiqueta y error.
 *
 * El error se liga con `aria-describedby` y se marca con `aria-invalid`: un
 * mensaje en rojo que el lector de pantalla no anuncia es un campo que, para
 * quien no ve el color, simplemente no funciona.
 */
export function Campo({
  etiqueta,
  nombre,
  error,
  ayuda,
  ...props
}: ComponentProps<'input'> & {
  etiqueta: string
  nombre: string
  error?: string
  ayuda?: string
}) {
  const idError = `${nombre}-error`
  const idAyuda = `${nombre}-ayuda`
  const descrito = [error ? idError : null, ayuda ? idAyuda : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nombre} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={nombre}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito || undefined}
        className={cn(
          'rounded-md border bg-white px-3 py-2 text-sm',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-acento)]',
          error
            ? 'border-[var(--color-urgente)]'
            : 'border-[var(--color-borde)]',
        )}
        {...props}
      />
      {ayuda ? (
        <p id={idAyuda} className="text-xs text-[var(--color-tinta-suave)]">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={idError} className="text-xs text-[var(--color-urgente)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

type TonoAviso = 'error' | 'informativo' | 'exito'

const ESTILO_AVISO: Record<TonoAviso, string> = {
  error:
    'border-[var(--color-urgente)]/30 bg-[var(--color-urgente)]/5 text-[var(--color-urgente)]',
  informativo:
    'border-[var(--color-borde)] bg-[var(--color-papel)] text-[var(--color-tinta-suave)]',
  exito:
    'border-[var(--color-holgado)]/30 bg-[var(--color-holgado)]/5 text-[var(--color-holgado)]',
}

export function Aviso({
  tono = 'informativo',
  children,
}: {
  tono?: TonoAviso
  children: ReactNode
}) {
  return (
    <div
      // `alert` hace que el lector de pantalla lo anuncie al aparecer, que es
      // justo lo que se espera de un error de formulario.
      role={tono === 'error' ? 'alert' : undefined}
      className={cn('rounded-md border px-3 py-2 text-sm', ESTILO_AVISO[tono])}
    >
      {children}
    </div>
  )
}

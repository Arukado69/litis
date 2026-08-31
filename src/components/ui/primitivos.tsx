import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

/**
 * Primitivos de interfaz. Sistema propio, no una librería de componentes.
 *
 * Son pocos a propósito: un despacho necesita leer datos densos —fechas,
 * números de expediente, carátulas— no animaciones. Todo lo que se agregue
 * aquí tiene que ganarse el lugar.
 *
 * Las reglas del sistema, en tres renglones:
 *   · **Sin sombras.** El papel no tiene sombra. La separación es una regla de
 *     un pixel o un cambio de fondo; nada de tarjetas flotando.
 *   · **El color solo informa.** Violeta = el sistema hizo algo; rojo = un
 *     término en riesgo; verde = en tiempo. Ningún color decora.
 *   · **Sin versalitas rastreadas de rótulo.** Si un dato necesita etiqueta,
 *     va en minúsculas y en su tamaño; gritar «FECHA» encima de una fecha no
 *     aclara nada y es el tic más repetido de una pantalla de plantilla.
 */

/** La superficie sobre la que se lee y se escribe. */
export function Foja({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-sm border border-[var(--color-regla)] bg-[var(--color-foja)] p-5',
        className,
      )}
      {...props}
    />
  )
}

/** El título de una sección dentro de una foja. */
export function Rotulo({ children }: { children: ReactNode }) {
  return <h2 className="text-guia">{children}</h2>
}

type VarianteBoton = 'primario' | 'secundario' | 'fantasma'

const ESTILO_BOTON: Record<VarianteBoton, string> = {
  primario:
    'bg-[var(--color-tinta)] text-[var(--color-foja)] hover:bg-[var(--color-sello)]',
  secundario:
    'border border-[var(--color-regla-fuerte)] bg-[var(--color-foja)] text-[var(--color-tinta)] hover:border-[var(--color-tinta)]',
  fantasma:
    'text-[var(--color-tinta-suave)] underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)] hover:decoration-[var(--color-sello)]',
}

export function Boton({
  variante = 'primario',
  className,
  ...props
}: ComponentProps<'button'> & { variante?: VarianteBoton }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-sm px-4 py-2 text-menor font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        ESTILO_BOTON[variante],
        className,
      )}
      {...props}
    />
  )
}

const CLASE_ENTRADA =
  'w-full rounded-sm border bg-[var(--color-foja)] px-3 py-2 text-obra placeholder:text-[var(--color-regla-fuerte)]'

function claseEntrada(error: string | undefined, extra?: string): string {
  return cn(
    CLASE_ENTRADA,
    error ? 'border-[var(--color-urgente)]' : 'border-[var(--color-regla)]',
    extra,
  )
}

function Envoltura({
  etiqueta,
  nombre,
  error,
  ayuda,
  children,
}: {
  etiqueta: string
  nombre: string
  error?: string
  ayuda?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nombre} className="text-menor font-medium">
        {etiqueta}
      </label>
      {children}
      {ayuda ? (
        <p
          id={`${nombre}-ayuda`}
          className="text-nota text-[var(--color-tinta-suave)]"
        >
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${nombre}-error`} className="text-nota text-[var(--color-urgente)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function descrito(
  nombre: string,
  error?: string,
  ayuda?: string,
): string | undefined {
  const ids = [error ? `${nombre}-error` : null, ayuda ? `${nombre}-ayuda` : null]
  return ids.filter(Boolean).join(' ') || undefined
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
  className,
  ...props
}: ComponentProps<'input'> & {
  etiqueta: string
  nombre: string
  error?: string
  ayuda?: string
}) {
  return (
    <Envoltura etiqueta={etiqueta} nombre={nombre} error={error} ayuda={ayuda}>
      <input
        id={nombre}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(nombre, error, ayuda)}
        className={claseEntrada(error, className)}
        {...props}
      />
    </Envoltura>
  )
}

export type Opcion = { valor: string; etiqueta: string }

export function Selector({
  etiqueta,
  nombre,
  opciones,
  error,
  ayuda,
  vacio = 'Elige…',
  className,
  ...props
}: Omit<ComponentProps<'select'>, 'children'> & {
  etiqueta: string
  nombre: string
  opciones: readonly Opcion[]
  error?: string
  ayuda?: string
  /** Texto de la opción vacía. `null` la quita. */
  vacio?: string | null
}) {
  return (
    <Envoltura etiqueta={etiqueta} nombre={nombre} error={error} ayuda={ayuda}>
      <select
        id={nombre}
        name={nombre}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(nombre, error, ayuda)}
        className={claseEntrada(error, className)}
        {...props}
      >
        {vacio === null ? null : <option value="">{vacio}</option>}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </Envoltura>
  )
}

export function Area({
  etiqueta,
  nombre,
  error,
  ayuda,
  className,
  ...props
}: ComponentProps<'textarea'> & {
  etiqueta: string
  nombre: string
  error?: string
  ayuda?: string
}) {
  return (
    <Envoltura etiqueta={etiqueta} nombre={nombre} error={error} ayuda={ayuda}>
      <textarea
        id={nombre}
        name={nombre}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={descrito(nombre, error, ayuda)}
        className={claseEntrada(error, className)}
        {...props}
      />
    </Envoltura>
  )
}

export function Casilla({
  etiqueta,
  nombre,
  ayuda,
  ...props
}: ComponentProps<'input'> & {
  etiqueta: string
  nombre: string
  ayuda?: string
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={nombre}
        name={nombre}
        type="checkbox"
        className="mt-1 accent-[var(--color-sello)]"
        {...props}
      />
      <div>
        <label htmlFor={nombre} className="text-menor font-medium">
          {etiqueta}
        </label>
        {ayuda ? (
          <p className="text-nota text-[var(--color-tinta-suave)]">{ayuda}</p>
        ) : null}
      </div>
    </div>
  )
}

type TonoAviso = 'error' | 'informativo' | 'exito'

const ESTILO_AVISO: Record<TonoAviso, string> = {
  error:
    'border-[var(--color-urgente)]/35 bg-[var(--color-urgente)]/5 text-[var(--color-urgente)]',
  informativo:
    'border-[var(--color-regla)] bg-[var(--color-tenue)] text-[var(--color-tinta-suave)]',
  exito:
    'border-[var(--color-holgado)]/35 bg-[var(--color-holgado)]/5 text-[var(--color-holgado)]',
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
      className={cn('rounded-sm border px-3 py-2 text-menor', ESTILO_AVISO[tono])}
    >
      {children}
    </div>
  )
}

type TonoSello = 'sello' | 'neutro' | 'urgente'

const ESTILO_SELLO: Record<TonoSello, string> = {
  sello:
    'border-[var(--color-sello)]/40 bg-[var(--color-sello-tenue)] text-[var(--color-sello)]',
  neutro: 'border-[var(--color-regla-fuerte)] text-[var(--color-tinta-suave)]',
  urgente: 'border-[var(--color-urgente)]/40 text-[var(--color-urgente)]',
}

/**
 * El sello: una marca corta de estado, en la tinta violeta del sello de
 * recibido. Se usa con cuentagotas — si todo lleva sello, el sello no marca
 * nada.
 */
export function Sello({
  children,
  tono = 'sello',
}: {
  children: ReactNode
  tono?: TonoSello
}) {
  return (
    <span
      className={cn(
        'inline-block rounded-sm border px-1.5 py-0.5 text-nota font-medium',
        ESTILO_SELLO[tono],
      )}
    >
      {children}
    </span>
  )
}

/** Un par etiqueta/valor de una ficha. */
export function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string
  children: ReactNode
}) {
  return (
    <div>
      <dt className="text-nota text-[var(--color-tinta-suave)]">{etiqueta}</dt>
      <dd className="mt-0.5 text-menor">{children}</dd>
    </div>
  )
}

export interface DiaDeCinta {
  fecha: string
  habil: boolean
}

/**
 * La cinta de días: el único gráfico del sistema.
 *
 * Cada celda es un día natural entre hoy y el vencimiento. Las sólidas son
 * hábiles; las vacías, no. Existe porque el error que hace perder términos es
 * exactamente ese: "faltan nueve días" suena holgado hasta que se ve que siete
 * están vacíos y solo quedan dos de trabajo.
 *
 * Lleva descripción para lector de pantalla: un gráfico que solo funciona
 * viendo colores no funciona.
 */
export function CintaDias({
  dias,
  descripcion,
  tamano = 'normal',
}: {
  dias: readonly DiaDeCinta[]
  descripcion: string
  tamano?: 'normal' | 'grande'
}) {
  if (dias.length === 0) return null
  const ultimo = dias.length - 1

  return (
    <div
      className="cinta"
      data-tamano={tamano}
      role="img"
      aria-label={descripcion}
      title={descripcion}
    >
      {dias.map((d, i) => (
        <span
          key={d.fecha}
          className="cinta-dia"
          data-habil={d.habil ? 'si' : 'no'}
          data-vence={i === ultimo ? 'si' : 'no'}
        />
      ))}
    </div>
  )
}

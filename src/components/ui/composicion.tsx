import Link from 'next/link'
import type { ReactNode } from 'react'

import type { Urgencia } from '@/lib/panel/pendientes'
import { cn } from '@/lib/utils/cn'

/**
 * Composición de pantalla.
 *
 * `primitivos.tsx` dice CON QUÉ se construye (foja, botón, campo, sello). Esto
 * dice CÓMO se compone una pantalla: la cabecera, el texto secundario, el
 * estado vacío y el renglón de lista.
 *
 * Son dos capas distintas a propósito. Un primitivo se usa dentro de un
 * formulario; esto ordena la página entera, y se usa igual en el panel, en el
 * portal y en las pantallas públicas.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE ESTE ARCHIVO
 * ─────────────────────────────────────────────────────────────────────────────
 * El vocabulario ya existía; lo que no existía era un lugar donde viviera. El
 * párrafo tenue estaba escrito a mano 69 veces en 23 archivos, la cabecera de
 * página en 11 y el renglón con margen en 16. Cada copia es una oportunidad de
 * que una pantalla quede medio pixel distinta de la de al lado, y de que una
 * corrección del sistema alcance a unas y a otras no.
 *
 * ⚠️ Estos componentes emiten EXACTAMENTE las mismas clases que el código que
 * reemplazan. No son un rediseño: son el mismo sistema, en un solo lugar. Si
 * algo se ve distinto después de usarlos, es un error, no una mejora.
 */

// ─────────────────────────────────────────────────────────────────────────────
// TEXTO SECUNDARIO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lo que acompaña al dato sin competir con él: la fecha bajo el título, el
 * responsable, el «notificado el…».
 *
 * Dos tamaños, que son los dos que el sistema usa: `menor` para lo que todavía
 * se lee de corrido y `nota` para el pie de un renglón.
 */
export function Tenue({
  tamano = 'menor',
  className,
  children,
  ...props
}: React.ComponentProps<'p'> & { tamano?: 'menor' | 'nota' }) {
  return (
    <p
      className={cn(
        tamano === 'nota' ? 'text-nota' : 'text-menor',
        'text-[var(--color-tinta-suave)]',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  )
}

/**
 * El estado vacío.
 *
 * ⚠️ Nunca dice solo «no hay nada»: dice qué falta y qué haría aparecer algo.
 * Una lista vacía sin explicación deja a quien llega preguntándose si el
 * sistema se rompió o si de verdad no tiene asuntos — y esa duda, en la
 * pantalla que existe para que nada pase desapercibido, es cara.
 */
export function Vacio({ children }: { children: ReactNode }) {
  return <Tenue className="mt-3">{children}</Tenue>
}

// ─────────────────────────────────────────────────────────────────────────────
// CABECERA DE PANTALLA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El enlace de regreso.
 *
 * Va arriba y no como flecha pegada a un botón: `docs/DISENO.md` §5 descarta
 * las «flechitas → pegadas a cada botón» como cromo de plantilla.
 */
export function Volver({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-menor text-[var(--color-tinta-suave)] underline decoration-[var(--color-regla-fuerte)] underline-offset-4"
    >
      {children}
    </Link>
  )
}

/**
 * La cabecera de una pantalla: de dónde vengo, qué estoy viendo, qué puedo
 * hacer aquí.
 *
 * `debajo` es la línea de identificación bajo el título —número interno, número
 * del juzgado, sellos de estado—. Va como `ReactNode` y no como lista de datos
 * porque cada pantalla identifica su objeto de forma distinta, y forzar una
 * forma común obligaría a inventar campos donde no los hay.
 */
export function Cabecera({
  volver,
  titulo,
  debajo,
  acciones,
}: {
  volver?: { href: string; texto: string }
  titulo: ReactNode
  debajo?: ReactNode
  acciones?: ReactNode
}) {
  return (
    <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
      {volver ? <Volver href={volver.href}>{volver.texto}</Volver> : null}

      <div
        className={cn(
          'flex flex-wrap items-end justify-between gap-4',
          volver ? 'mt-2' : null,
        )}
      >
        <div>
          <h1 className="text-rotulo">{titulo}</h1>
          {debajo ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-menor text-[var(--color-tinta-suave)]">
              {debajo}
            </p>
          ) : null}
        </div>

        {acciones ? <div className="flex gap-3">{acciones}</div> : null}
      </div>
    </div>
  )
}

/**
 * El rótulo de una sección con su cuenta a la derecha: «Audiencias · 3
 * señaladas».
 *
 * La cuenta va aquí y no dentro de la lista porque se lee ANTES de decidir si
 * vale la pena mirar la lista. En una pantalla que se escanea, saber que hay
 * cero documentos sin recorrer la sección es la mitad del trabajo.
 */
export function RotuloDeSeccion({
  children,
  cuenta,
}: {
  children: ReactNode
  cuenta?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-4">
      <h2 className="text-guia">{children}</h2>
      {cuenta ? (
        <span className="text-menor text-[var(--color-tinta-suave)]">{cuenta}</span>
      ) : null}
    </div>
  )
}

/**
 * Lo que ya pasó, plegado.
 *
 * ⚠️ Plegado no es escondido, y la diferencia importa: los plazos cerrados y
 * las audiencias celebradas son la memoria del asunto —ahí está escrito lo que
 * se presentó tarde— así que se conservan enteros y a un clic. Lo que no hacen
 * es competir por la mirada con lo que todavía corre.
 */
export function Apartado({
  resumen,
  children,
}: {
  resumen: ReactNode
  children: ReactNode
}) {
  return (
    <details className="text-menor">
      <summary className="cursor-pointer text-[var(--color-tinta-suave)]">
        {resumen}
      </summary>
      <ul className="mt-2 flex flex-col gap-2">{children}</ul>
    </details>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// RENGLÓN DE LISTA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * La urgencia de un renglón, que decide el color de su margen.
 *
 * ⚠️ **Se importa del dominio, no se redeclara aquí.** Escribirla a mano
 * parecía inofensivo y se equivocó al primer intento: deducir la unión de los
 * selectores de `.margen` en `globals.css` da tres valores, y el dominio tiene
 * cuatro. `proximo` no tiñe el margen —a propósito: no amerita color— así que
 * no aparece en el CSS, pero existe. Una copia que se ve bien hasta que alguien
 * agrega un caso es exactamente lo que este proyecto ya pagó caro en otros
 * lados.
 *
 * El color sigue viviendo en `globals.css`: ahí hay UNA definición de qué tan
 * rojo es «vencido».
 */
export type { Urgencia }

/**
 * Un renglón de lista, con el margen del expediente por el costado.
 *
 * Dos formas, y la diferencia no es estética:
 *
 * · **`vivo`** — la regla de 3px de `.margen` sobre fondo de foja. Es algo que
 *   pide atención, y admite `urgencia` para teñir el margen.
 * · **`apagado`** — regla fina y texto tenue. Es historial: ya pasó, se
 *   conserva porque es la memoria del asunto, pero no compite por la mirada.
 *
 * Lo cerrado no se borra ni se esconde: se aparta. Ahí es donde queda escrito
 * lo que se presentó tarde.
 */
export function Renglon({
  forma = 'vivo',
  urgencia,
  className,
  children,
  ...props
}: React.ComponentProps<'li'> & {
  forma?: 'vivo' | 'apagado'
  urgencia?: Urgencia
}) {
  return (
    <li
      data-urgencia={urgencia}
      className={cn(
        forma === 'vivo'
          ? 'margen bg-[var(--color-foja)] py-3 pl-4 pr-3'
          : 'border-l-2 border-[var(--color-regla)] py-2 pl-4 text-[var(--color-tinta-suave)]',
        className,
      )}
      {...props}
    >
      {children}
    </li>
  )
}

/**
 * La línea de arriba de un renglón: el nombre a la izquierda y la fecha a la
 * derecha, cediendo a dos renglones cuando no caben.
 *
 * Existe como componente porque el `flex flex-wrap items-baseline
 * justify-between` estaba copiado en cada lista, y basta que una lo escriba
 * distinto para que sus fechas dejen de alinearse con las de al lado.
 */
export function LineaDeRenglon({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

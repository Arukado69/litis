import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * ⚠️ **A `tailwind-merge` hay que enseñarle la escala tipográfica del proyecto.**
 *
 * Los seis tamaños viven en `globals.css` como `--text-nota`, `--text-menor`,
 * `--text-obra`, `--text-guia`, `--text-rotulo` y `--text-portada`. Sin
 * declararlos aquí, `tailwind-merge` no sabe que `text-menor` es un TAMAÑO: lo
 * toma por un color, lo ve chocar con `text-[var(--color-tinta-suave)]` y
 * **descarta el tamaño en silencio**.
 *
 * No es hipotético y no lo trajo un refactor: `Sello` y `Aviso` llevaban desde
 * que se escribieron perdiendo su `text-nota` y su `text-menor` en cuanto se
 * les pasaba un tono de color. Se veían un punto más grandes de lo que el
 * sistema dice, en toda la aplicación, sin que nada fallara.
 *
 * Lo destapó comparar el HTML renderizado antes y después de un cambio. Una
 * clase que se cae no rompe el build ni una prueba: solo se ve distinto, y
 * nadie tiene el antes a la mano para comparar.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['nota', 'menor', 'obra', 'guia', 'rotulo', 'portada'] },
      ],
    },
  },
})

/**
 * Une clases resolviendo los conflictos de Tailwind: la última gana.
 * Sin `twMerge`, pasar `className="px-8"` a un componente que ya trae `px-4`
 * deja las dos y decide el orden del CSS, no quien llama.
 */
export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases))
}

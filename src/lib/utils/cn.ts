import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Une clases resolviendo los conflictos de Tailwind: la última gana.
 * Sin `twMerge`, pasar `className="px-8"` a un componente que ya trae `px-4`
 * deja las dos y decide el orden del CSS, no quien llama.
 */
export function cn(...clases: ClassValue[]): string {
  return twMerge(clsx(clases))
}

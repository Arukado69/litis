import { Archivo, Petrona } from 'next/font/google'

/**
 * Las dos familias, cargadas en UN solo lugar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTAS Y NO OTRAS
 * ─────────────────────────────────────────────────────────────────────────────
 * **Archivo** (Omnibus-Type, Buenos Aires) es la voz de trabajo: una grotesca
 * de eje variable pensada para texto denso y para pantalla, dibujada para el
 * español —acentos, eñe, apertura de la «a» y la «e»— por un taller
 * latinoamericano. Se llama como se llama por una razón que aquí encaja:
 * archivo es donde vive un expediente.
 *
 * **Petrona** (Huerta Tipográfica, del taller de Ana Sanfelippo) es la voz de
 * los títulos: una serif variable diseñada explícitamente para el español
 * latinoamericano, con más carácter que las serifs de alto contraste que se
 * reparten por defecto. Da autoridad de documento sin sonar a periódico
 * británico.
 *
 * Se cargan por `next/font`, o sea **auto-hospedadas**: cero peticiones a
 * Google desde el navegador del abogado. No es purismo, es que un despacho
 * revisa expedientes desde la sala de espera de un juzgado, con la red que
 * haya.
 *
 * ⚠️ Las cifras se componen **tabulares** (ver `globals.css`). Este producto es
 * columnas de fechas, números de expediente y días restantes: si el «1» mide
 * menos que el «8», las columnas bailan y comparar dos renglones deja de ser
 * automático.
 */

export const archivo = Archivo({
  subsets: ['latin', 'latin-ext'],
  variable: '--fuente-obra',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', 'sans-serif'],
})

export const petrona = Petrona({
  subsets: ['latin', 'latin-ext'],
  variable: '--fuente-titulo',
  display: 'swap',
  fallback: ['ui-serif', 'Georgia', 'serif'],
})

/** Para colgar del `<html>`. */
export const CLASES_FUENTES = `${archivo.variable} ${petrona.variable}`

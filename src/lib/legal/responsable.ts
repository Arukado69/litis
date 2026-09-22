/**
 * Los datos que un documento legal no puede inventar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTÁN VACÍOS Y NO RELLENOS CON ALGO PLAUSIBLE
 * ─────────────────────────────────────────────────────────────────────────────
 * Un aviso de privacidad tiene que decir **quién** es el responsable y **dónde**
 * está: es lo primero que exige la LFPDPPP. Poner una razón social inventada o
 * un domicilio de relleno no es un borrador, es un documento falso publicado en
 * un sitio que pide datos personales de abogados y de sus clientes.
 *
 * Así que quedan vacíos, las páginas lo anuncian arriba mientras lo estén, y el
 * aviso desaparece solo en cuanto se llenen. Lo que falta de una persona real
 * se anota como bloqueo; no se inventa.
 *
 * ⚠️ Llenar esto NO vuelve buenos los documentos. El texto es un andamio
 * técnico —describe con exactitud qué datos toca el sistema, dónde viven y
 * quién los procesa— y tiene que revisarlo alguien que responda por él antes de
 * publicarse. Lo primero que hay que verificar son las citas de artículos.
 */

import { AVISO_COMPUTO } from '@/lib/brand'
import { MONEDA, PLANES } from '@/lib/marketing/planes'
import { TOPES_POR_PLAN } from '@/lib/suscripcion/limites'

export interface Responsable {
  /** La persona física o moral que responde. */
  razonSocial: string
  /** Domicilio para oír y recibir notificaciones. */
  domicilio: string
  /** A dónde se mandan las solicitudes de acceso, rectificación, cancelación y oposición. */
  correoPrivacidad: string
  /** Ciudad cuyos tribunales conocen de una controversia. */
  jurisdiccion: string
}

export const RESPONSABLE: Responsable = {
  razonSocial: '',
  domicilio: '',
  correoPrivacidad: '',
  jurisdiccion: '',
}

/**
 * Si el precio lleva IVA incluido o por encima.
 *
 * **Decidido: por encima.** Los $390 son la base y el impuesto se suma, que es
 * como se cobra un SaaS a un despacho —el cliente acredita el IVA y lo quiere
 * desglosado en su factura—.
 *
 * ⚠️ **Falta reflejarlo en Stripe, y es un cambio de una sola vez.** El precio
 * (`price_1UB3wHRD2Fg2YJsu3660vmro`) quedó con `tax_behavior: unspecified`, y
 * Stripe solo deja fijarlo UNA vez: tiene que quedar en `exclusive`. Mientras no
 * se haga, esta constante y la cuenta de cobro dicen cosas distintas — y la que
 * le cobra al despacho es la de Stripe.
 */
export type TratoDelIva = 'incluido' | 'adicional'
export const IVA: TratoDelIva | null = 'adicional'

/**
 * Lo que se pone junto a un precio en pantalla.
 *
 * Sale de la misma constante que la cláusula de los términos, no de una cadena
 * escrita a mano en la portada. Un precio público que no dice «+ IVA» mientras
 * el contrato sí lo dice es la misma mentira por omisión de siempre, y aquí
 * vale un 16 % de lo que el despacho creyó que iba a pagar.
 */
export function sufijoDeIva(iva: TratoDelIva | null = IVA): string | null {
  if (iva === 'adicional') return '+ IVA'
  if (iva === 'incluido') return 'IVA incluido'
  return null
}

/**
 * Fecha de la última actualización de los documentos.
 *
 * ⚠️ No es decorativa: la cláusula 12 de los términos promete que «si estos
 * términos cambian, la fecha de arriba lo refleja». Un documento legal que
 * declara una fecha de vigencia anterior a su propio texto se desmiente solo, y
 * es lo único de estas páginas que se puede comprobar desde afuera.
 *
 * Ya falló una vez: la cláusula 11 se reescribió el 14 de septiembre —al
 * construir la exportación del despacho— y esta fecha se quedó en el 2. Nada lo
 * dijo, porque nada lo estaba mirando. De ahí salen las dos huellas de abajo:
 * una sobre los archivos publicados y otra sobre los datos que se imprimen
 * dentro de ellos.
 */
export const VIGENCIA = '2026-09-18'

/**
 * La huella de los documentos a los que esa fecha se refiere.
 *
 * ⚠️ **Vive pegada a `VIGENCIA` a propósito.** Hay una prueba que rehace estos
 * hashes y falla si el texto se movió: entonces hay que venir aquí, y al venir
 * se ve la fecha justo arriba. Separarlos —dejar la huella en el archivo de
 * pruebas— habría permitido actualizar una sin mirar la otra, que es
 * exactamente el error que esto existe para impedir.
 *
 * Que un cambio de formato también la rompa no es un defecto: en un documento
 * legal, «¿esto cambió lo que promete?» es la pregunta correcta ante cualquier
 * edición, y contestarla cuesta un minuto.
 */
export const HUELLA_VIGENTE: Record<string, string> = {
  'src/app/(legal)/terminos-y-condiciones/page.tsx': '0ff2356e03ea2e5b',
  'src/app/(legal)/aviso-de-privacidad/page.tsx': '86b31cb301221a41',
  'src/lib/legal/tratamiento.ts': '63c56549daab077c',
}

/**
 * La huella de los DATOS que se imprimen dentro de esos documentos.
 *
 * ⚠️ **Sin esto, el candado de arriba tendría un hueco por donde cabe lo que
 * más cambia.** Buena parte del texto publicado no está en los archivos de las
 * páginas: sale de constantes. Cambiar la razón social —o el precio— movería lo
 * que el documento promete sin tocar un solo byte de `page.tsx`, y el hash de
 * archivos no se enteraría.
 *
 * ⚠️ **Y no son solo los datos del responsable.** La primera versión de esta
 * huella cubría `RESPONSABLE` y el IVA, y dejaba fuera el precio, la moneda,
 * los topes del plan gratuito y `AVISO_COMPUTO` — que los términos también
 * imprimen. Subir el precio de 390 a 490 habría cambiado la cláusula 3 con las
 * dos huellas en verde y la fecha de vigencia intacta: el mismo hueco que esto
 * vino a tapar, un piso más abajo. `datosPublicados()` los junta todos.
 *
 * Se calcula sobre los VALORES, no sobre este archivo, para que no sea
 * circular: un comentario nuevo aquí no la rompe; un dato distinto sí.
 */
export const HUELLA_DATOS = 'bd5913d1fefa24be'

/**
 * Todo lo que los documentos publicados imprimen y no vive en sus archivos.
 *
 * Si una cláusula empieza a citar una constante nueva, se agrega aquí — o el
 * documento podrá cambiar de fondo sin que la fecha de vigencia se entere.
 */
export function datosPublicados() {
  return {
    responsable: RESPONSABLE,
    iva: IVA,
    // Los términos citan el precio y la moneda en la cláusula del plan…
    precios: PLANES.map((p) => ({ clave: p.clave, precio: p.precio })),
    moneda: MONEDA,
    // …los topes del plan gratuito…
    topesGratuito: TOPES_POR_PLAN.gratuito,
    // …y el aviso del cómputo, palabra por palabra, el mismo de la pantalla.
    avisoComputo: AVISO_COMPUTO,
  }
}

const ETIQUETA_PENDIENTE: Record<keyof Responsable, string> = {
  razonSocial: 'la razón social o el nombre de quien responde',
  domicilio: 'el domicilio del responsable',
  correoPrivacidad: 'el correo para las solicitudes de derechos ARCO',
  jurisdiccion: 'la ciudad cuyos tribunales serían competentes',
}

/** Qué falta para que los documentos puedan publicarse. */
export function datosPendientes(
  responsable: Responsable = RESPONSABLE,
  iva: TratoDelIva | null = IVA,
): string[] {
  const faltan = (Object.keys(ETIQUETA_PENDIENTE) as (keyof Responsable)[])
    .filter((campo) => responsable[campo].trim() === '')
    .map((campo) => ETIQUETA_PENDIENTE[campo])

  if (iva === null) {
    faltan.push('si el precio lleva IVA incluido o por encima')
  }

  return faltan
}

/** Mientras falte algo, las páginas se anuncian como borrador. */
export function esBorrador(
  responsable: Responsable = RESPONSABLE,
  iva: TratoDelIva | null = IVA,
): boolean {
  return datosPendientes(responsable, iva).length > 0
}

/**
 * Lo que dice el documento sobre el IVA.
 *
 * Devuelve `null` mientras no se decida, y la página omite la frase en vez de
 * escribir una que podría ser falsa. Decir "más IVA" cuando se cobró con IVA
 * incluido —o al revés— es una diferencia del 16 % en lo que el cliente creyó
 * que iba a pagar.
 */
export function frenteAlIva(iva: TratoDelIva | null = IVA): string | null {
  if (iva === 'incluido') {
    return 'Los precios que se muestran ya incluyen el impuesto al valor agregado.'
  }
  if (iva === 'adicional') {
    return 'A los precios que se muestran se les suma el impuesto al valor agregado.'
  }
  return null
}

/** Para escribir "según la razón social" sin dejar un hueco en la frase. */
export function nombreDelResponsable(
  responsable: Responsable = RESPONSABLE,
): string {
  return responsable.razonSocial.trim() || 'el responsable de Litis'
}

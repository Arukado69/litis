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
 * Sin decidir. En Stripe el precio quedó con `tax_behavior: unspecified`, que es
 * la única propiedad que se puede cambiar **una sola vez**, así que la decisión
 * se toma antes de cobrarle a nadie y se refleja aquí.
 */
export type TratoDelIva = 'incluido' | 'adicional'
export const IVA: TratoDelIva | null = null

/** Fecha de la última actualización de los documentos. */
export const VIGENCIA = '2026-09-02'

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

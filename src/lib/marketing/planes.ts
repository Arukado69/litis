/**
 * Los planes, en UN solo lugar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTOS PRECIOS SON UNA HIPÓTESIS, NO UN DATO
 * ─────────────────────────────────────────────────────────────────────────────
 * No hay un solo despacho usando esto todavía, así que el precio no sale de
 * ninguna medición: sale de una lectura del mercado mexicano —lo que cuesta una
 * hora de pasante, lo que cuesta perder un término— y de la decisión de cobrar
 * por usuario al mes con un nivel gratuito.
 *
 * Está escrito aquí y dicho en la página en vez de presentarse como una verdad
 * calculada. Cuando haya cinco despachos pagando, este archivo se corrige con
 * lo que se aprendió.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ EL NIVEL GRATUITO TIENE TOPE DE EXPEDIENTES Y NO DE DÍAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Una prueba de catorce días no sirve para esto: el valor del producto aparece
 * el día que un plazo está por vencerse, y eso puede tardar un mes en pasar. Un
 * tope de expedientes deja que el litigante lo use de verdad, con asuntos
 * reales, hasta que el despacho crezca — y para entonces ya sabe si le sirve.
 */

export interface Plan {
  clave: 'solo' | 'despacho'
  nombre: string
  /** Pesos por usuario al mes. `0` es gratis. */
  precio: number
  /** La frase que decide. Una, no tres. */
  promesa: string
  incluye: readonly string[]
  /** Lo que este plan NO alcanza. Se dice aquí, no en la letra chica. */
  tope: string | null
  destacado: boolean
}

export const MONEDA = 'MXN'

export const PLANES: readonly Plan[] = [
  {
    clave: 'solo',
    nombre: 'Litigante solo',
    precio: 0,
    promesa: 'Para llevar tus propios asuntos sin perder un término.',
    incluye: [
      'Hasta 10 expedientes activos',
      'Cómputo de plazos con la traza a la vista',
      'Agenda de audiencias y vencimientos',
      'Alertas por correo antes de cada vencimiento',
      'Bitácora del expediente',
    ],
    tope: 'Un solo usuario. Sin equipo ni documentos.',
    destacado: false,
  },
  {
    clave: 'despacho',
    nombre: 'Despacho',
    precio: 390,
    promesa: 'Para un equipo que se reparte los asuntos.',
    incluye: [
      'Expedientes sin tope',
      'Todo el equipo, con papeles y bajas',
      'Documentos en almacén privado, con versiones',
      'Detección de conflicto de interés contra tu padrón',
      'Reparto de responsables y aviso de días imposibles',
    ],
    tope: null,
    destacado: true,
  },
]

/** "$390" o "Gratis". */
export function precioLegible(plan: Plan): string {
  if (plan.precio === 0) return 'Gratis'
  return `$${plan.precio.toLocaleString('es-MX')}`
}

/**
 * Lo que el producto NO hace.
 *
 * Va en la página, no escondido. Un litigante que descubre en la semana tres
 * que esto no consulta boletines se siente engañado, y con razón. Decirlo antes
 * cuesta algunos registros y ahorra todas las bajas.
 */
export const NO_HACE: readonly { que: string; porque: string }[] = [
  {
    que: 'No consulta los boletines judiciales por ti',
    porque:
      'Depende de sistemas que cambian sin avisar. Un aviso que falla en silencio es peor que no tenerlo, así que va cuando el resto sea sólido.',
  },
  {
    que: 'No decide si tienes un impedimento',
    porque:
      'Cruza las partes contra tu padrón y te enseña las coincidencias con su evidencia. La decisión y la constancia son tuyas.',
  },
  {
    que: 'No es asesoría jurídica ni emite dictámenes',
    porque:
      'Los cómputos son control interno. La responsabilidad del término es de quien firma la promoción.',
  },
  {
    que: 'No factura ni cobra honorarios todavía',
    porque:
      'Primero tiene que ser irreprochable en lo que evita perder un término. Lo demás viene después.',
  },
]

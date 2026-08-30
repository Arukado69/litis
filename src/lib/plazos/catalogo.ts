/**
 * Catálogo semilla de plazos procesales.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ LEE ESTO ANTES DE USAR UN SOLO NÚMERO DE AQUÍ
 * ─────────────────────────────────────────────────────────────────────────────
 * Este catálogo es un PUNTO DE PARTIDA para que un despacho no capture treinta
 * plazos a mano el primer día. No es una fuente de derecho y no está
 * verificado. Cada entrada nace como `semilla_no_verificada` y así se muestra
 * en pantalla hasta que un abogado del despacho la confirme contra el texto
 * vigente y quede registrado quién la confirmó y cuándo.
 *
 * Las razones de que esto NO pueda entregarse como verdad cerrada:
 *
 *   · Los ordenamientos se reforman, y los plazos son de lo primero que se
 *     toca. El Código Nacional de Procedimientos Civiles y Familiares está
 *     desplazando de forma escalonada a los códigos locales hasta 2027.
 *   · Un mismo recurso tiene plazos distintos según la vía, la cuantía y la
 *     entidad.
 *   · Varios plazos tienen excepciones que no caben en un número: supuestos en
 *     que corren en cualquier tiempo, en horas, o desde un hecho distinto de
 *     la notificación.
 *
 * El diseño asume que el catálogo está mal hasta que alguien lo revise. Por eso
 * el flujo del producto es: la herramienta propone → el abogado verifica →
 * queda la constancia. Nunca al revés.
 */

import type {
  EstadoVerificacion,
  IdRegimen,
  UnidadPlazo,
} from './regimenes'

export interface PlazoCatalogo {
  /** Estable; es la llave con la que el expediente referencia el plazo. */
  id: string
  regimen: IdRegimen
  /** Cómo lo nombra un abogado, no cómo lo nombra la ley. */
  etiqueta: string
  dias: number
  unidad: UnidadPlazo
  /** El artículo o los artículos de donde sale. */
  fundamento: string
  /** Cuándo aplica y qué revisar antes de usarlo. */
  nota?: string
  verificacion: EstadoVerificacion
}

/** Todo lo que sale de fábrica nace sin verificar. Sin excepciones. */
const S: EstadoVerificacion = 'semilla_no_verificada'

export const CATALOGO_PLAZOS: readonly PlazoCatalogo[] = [
  // ── Mercantil ──────────────────────────────────────────────────────────────
  {
    id: 'merc.contestacion.ordinario',
    regimen: 'mercantil',
    etiqueta: 'Contestación de demanda — juicio ordinario mercantil',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1378',
    verificacion: S,
  },
  {
    id: 'merc.contestacion.ejecutivo',
    regimen: 'mercantil',
    etiqueta: 'Contestación y oposición de excepciones — ejecutivo mercantil',
    dias: 8,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1399',
    nota: 'Corre desde el requerimiento y emplazamiento. Confirma la fecha del acta del actuario.',
    verificacion: S,
  },
  {
    id: 'merc.contestacion.oral',
    regimen: 'mercantil',
    etiqueta: 'Contestación de demanda — juicio oral mercantil',
    dias: 9,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1390 Bis 17',
    verificacion: S,
  },
  {
    id: 'merc.apelacion.definitiva',
    regimen: 'mercantil',
    etiqueta: 'Apelación contra sentencia definitiva',
    dias: 9,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1079',
    nota: 'Revisa además la cuantía: la apelación no procede en todos los asuntos.',
    verificacion: S,
  },
  {
    id: 'merc.apelacion.interlocutoria',
    regimen: 'mercantil',
    etiqueta: 'Apelación contra auto o sentencia interlocutoria',
    dias: 6,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1079',
    verificacion: S,
  },
  {
    id: 'merc.revocacion',
    regimen: 'mercantil',
    etiqueta: 'Recurso de revocación',
    dias: 3,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1079',
    nota: 'Plazo muy corto: es de los que más se pierden. Verifícalo apenas se notifique el auto.',
    verificacion: S,
  },

  // ── Amparo ─────────────────────────────────────────────────────────────────
  {
    id: 'amp.demanda.indirecto',
    regimen: 'amparo',
    etiqueta: 'Demanda de amparo indirecto',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Ley de Amparo, art. 17',
    nota: 'Hay supuestos de excepción con plazos distintos o sin plazo. Revisa el art. 17 completo antes de aplicar los 15 días.',
    verificacion: S,
  },
  {
    id: 'amp.demanda.directo',
    regimen: 'amparo',
    etiqueta: 'Demanda de amparo directo',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Ley de Amparo, art. 17',
    nota: 'Se presenta ante la autoridad responsable, no ante el Tribunal Colegiado. Agenda el lugar de presentación junto con la fecha.',
    verificacion: S,
  },
  {
    id: 'amp.demanda.norma_autoaplicativa',
    regimen: 'amparo',
    etiqueta: 'Amparo contra norma general autoaplicativa',
    dias: 30,
    unidad: 'habiles',
    fundamento: 'Ley de Amparo, art. 17, fr. I',
    nota: 'Corre desde la entrada en vigor de la norma. Si se reclama con motivo del primer acto de aplicación, el plazo es el general.',
    verificacion: S,
  },
  {
    id: 'amp.revision',
    regimen: 'amparo',
    etiqueta: 'Recurso de revisión',
    dias: 10,
    unidad: 'habiles',
    fundamento: 'Ley de Amparo, art. 86',
    verificacion: S,
  },
  {
    id: 'amp.queja',
    regimen: 'amparo',
    etiqueta: 'Recurso de queja',
    dias: 5,
    unidad: 'habiles',
    fundamento: 'Ley de Amparo, art. 98',
    nota: 'El plazo NO es uniforme: hay supuestos de dos días y otros en que procede en cualquier tiempo. Identifica la fracción aplicable antes de agendar.',
    verificacion: S,
  },
  {
    id: 'amp.reclamacion',
    regimen: 'amparo',
    etiqueta: 'Recurso de reclamación',
    dias: 3,
    unidad: 'habiles',
    fundamento: 'Ley de Amparo, art. 105',
    verificacion: S,
  },

  // ── Contencioso administrativo federal ─────────────────────────────────────
  {
    id: 'tfja.demanda.ordinaria',
    regimen: 'contencioso_administrativo',
    etiqueta: 'Demanda de nulidad — vía ordinaria',
    dias: 30,
    unidad: 'habiles',
    fundamento: 'Ley Federal de Procedimiento Contencioso Administrativo, art. 13',
    verificacion: S,
  },
  {
    id: 'tfja.demanda.sumaria',
    regimen: 'contencioso_administrativo',
    etiqueta: 'Demanda de nulidad — vía sumaria',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Ley Federal de Procedimiento Contencioso Administrativo, art. 58-2',
    nota: 'La vía sumaria depende de la cuantía y del tipo de resolución. Si el asunto encuadra en sumaria y presentas en 30 días, llegas tarde.',
    verificacion: S,
  },
  {
    id: 'tfja.ampliacion',
    regimen: 'contencioso_administrativo',
    etiqueta: 'Ampliación de demanda',
    dias: 10,
    unidad: 'habiles',
    fundamento: 'Ley Federal de Procedimiento Contencioso Administrativo, art. 17',
    verificacion: S,
  },

  // ── Fiscal ─────────────────────────────────────────────────────────────────
  {
    id: 'cff.revocacion',
    regimen: 'fiscal_administrativo',
    etiqueta: 'Recurso de revocación',
    dias: 30,
    unidad: 'habiles',
    fundamento: 'Código Fiscal de la Federación, art. 121',
    nota: 'Si la notificación fue por buzón tributario, la fecha de notificación no es la del envío. Revisa el acuse.',
    verificacion: S,
  },
]

export function plazosDeRegimen(regimen: IdRegimen): PlazoCatalogo[] {
  return CATALOGO_PLAZOS.filter((p) => p.regimen === regimen)
}

export function buscarPlazo(id: string): PlazoCatalogo | null {
  return CATALOGO_PLAZOS.find((p) => p.id === id) ?? null
}

/** Los ids son la llave del expediente: si se repiten, se pisan los plazos. */
export function idsDuplicados(): string[] {
  const vistos = new Set<string>()
  const repetidos = new Set<string>()
  for (const p of CATALOGO_PLAZOS) {
    if (vistos.has(p.id)) repetidos.add(p.id)
    vistos.add(p.id)
  }
  return [...repetidos]
}

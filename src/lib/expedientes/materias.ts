/**
 * Materias y vías procesales.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ LA "VÍA" ES LA UNIDAD Y NO LA "MATERIA"
 * ─────────────────────────────────────────────────────────────────────────────
 * Decir que un asunto es "mercantil" no determina casi nada operativo. Un
 * ejecutivo mercantil y un ordinario mercantil comparten materia y no comparten
 * casi ninguna etapa, ni los plazos, ni lo que hay que hacer primero: en el
 * ejecutivo se embarga antes de emplazar, en el ordinario no existe esa etapa.
 *
 * La VÍA es lo que determina el procedimiento. Por eso las etapas, los plazos
 * sugeridos y la lista de partes cuelgan de la vía, no de la materia. La
 * materia solo sirve para agrupar en la interfaz y para reportes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ EL FUERO NO ES UN ADORNO
 * ─────────────────────────────────────────────────────────────────────────────
 * El mismo tipo de asunto puede tramitarse en fuero federal o común, y de eso
 * dependen el órgano, el calendario de días inhábiles y a veces el plazo. Un
 * expediente sin fuero capturado no puede computar plazos con confianza, y el
 * modelo lo trata como dato obligatorio.
 */

import type { IdRegimen } from '@/lib/plazos/regimenes'

export type IdMateria =
  | 'civil'
  | 'mercantil'
  | 'familiar'
  | 'laboral'
  | 'penal'
  | 'administrativo'
  | 'fiscal'
  | 'amparo'
  | 'corporativo'

export type Fuero = 'federal' | 'comun'

export const FUERO_ETIQUETA: Record<Fuero, string> = {
  federal: 'Federal',
  comun: 'Común (local)',
}

export interface Materia {
  id: IdMateria
  nombre: string
  descripcion: string
  /** Si es consultivo, no hay juicio ni plazos procesales que computar. */
  contencioso: boolean
}

export const MATERIAS: Record<IdMateria, Materia> = {
  civil: {
    id: 'civil',
    nombre: 'Civil',
    descripcion: 'Obligaciones, contratos, arrendamiento, propiedad, sucesiones.',
    contencioso: true,
  },
  mercantil: {
    id: 'mercantil',
    nombre: 'Mercantil',
    descripcion: 'Títulos de crédito, contratos mercantiles, cobranza judicial.',
    contencioso: true,
  },
  familiar: {
    id: 'familiar',
    nombre: 'Familiar',
    descripcion: 'Divorcio, alimentos, guarda y custodia, régimen de convivencia.',
    contencioso: true,
  },
  laboral: {
    id: 'laboral',
    nombre: 'Laboral',
    descripcion:
      'Conflictos individuales y colectivos de trabajo ante Centros de Conciliación y Tribunales Laborales.',
    contencioso: true,
  },
  penal: {
    id: 'penal',
    nombre: 'Penal',
    descripcion: 'Sistema penal acusatorio, defensa y asesoría jurídica de la víctima.',
    contencioso: true,
  },
  administrativo: {
    id: 'administrativo',
    nombre: 'Administrativo',
    descripcion: 'Nulidad de actos administrativos, responsabilidades, licencias y permisos.',
    contencioso: true,
  },
  fiscal: {
    id: 'fiscal',
    nombre: 'Fiscal',
    descripcion: 'Créditos fiscales, recursos administrativos, procedimientos de fiscalización.',
    contencioso: true,
  },
  amparo: {
    id: 'amparo',
    nombre: 'Amparo',
    descripcion: 'Amparo indirecto y directo, y sus recursos.',
    contencioso: true,
  },
  corporativo: {
    id: 'corporativo',
    nombre: 'Corporativo y consultivo',
    descripcion:
      'Constitución de sociedades, actas, contratos, gobierno corporativo y opiniones. Sin juicio de por medio.',
    contencioso: false,
  },
}

export const LISTA_MATERIAS: readonly Materia[] = Object.values(MATERIAS)

export interface Via {
  id: string
  materia: IdMateria
  nombre: string
  /** Qué reglas de cómputo de plazos aplican a esta vía. */
  regimen: IdRegimen
  /** En qué fueros puede tramitarse. */
  fueros: readonly Fuero[]
  descripcion: string
}

export const VIAS: readonly Via[] = [
  // ── Mercantil ──────────────────────────────────────────────────────────────
  {
    id: 'merc.ordinario',
    materia: 'mercantil',
    nombre: 'Juicio ordinario mercantil',
    regimen: 'mercantil',
    fueros: ['federal', 'comun'],
    descripcion: 'Vía general cuando no procede una especial.',
  },
  {
    id: 'merc.ejecutivo',
    materia: 'mercantil',
    nombre: 'Juicio ejecutivo mercantil',
    regimen: 'mercantil',
    fueros: ['federal', 'comun'],
    descripcion:
      'Procede con título ejecutivo. Se requiere de pago, se embarga y luego se emplaza: el orden importa y cambia el checklist.',
  },
  {
    id: 'merc.oral',
    materia: 'mercantil',
    nombre: 'Juicio oral mercantil',
    regimen: 'mercantil',
    fueros: ['federal', 'comun'],
    descripcion: 'Audiencias orales y plazos más cortos que el ordinario.',
  },
  {
    id: 'merc.oral_ejecutivo',
    materia: 'mercantil',
    nombre: 'Juicio oral ejecutivo mercantil',
    regimen: 'mercantil',
    fueros: ['federal', 'comun'],
    descripcion: 'Ejecución con título, tramitada en vía oral.',
  },

  // ── Civil ──────────────────────────────────────────────────────────────────
  {
    id: 'civ.ordinario',
    materia: 'civil',
    nombre: 'Juicio ordinario civil',
    regimen: 'civil_familiar_local',
    fueros: ['comun', 'federal'],
    descripcion: 'Vía general en materia civil.',
  },
  {
    id: 'civ.especial_hipotecario',
    materia: 'civil',
    nombre: 'Juicio especial hipotecario',
    regimen: 'civil_familiar_local',
    fueros: ['comun'],
    descripcion: 'Ejecución de garantía hipotecaria.',
  },
  {
    id: 'civ.sucesorio',
    materia: 'civil',
    nombre: 'Sucesión testamentaria o intestamentaria',
    regimen: 'civil_familiar_local',
    fueros: ['comun'],
    descripcion:
      'Cuatro secciones y un albacea. No sigue el patrón demanda-contestación-sentencia: su tablero es distinto.',
  },

  // ── Familiar ───────────────────────────────────────────────────────────────
  {
    id: 'fam.controversia',
    materia: 'familiar',
    nombre: 'Controversia del orden familiar',
    regimen: 'civil_familiar_local',
    fueros: ['comun'],
    descripcion: 'Alimentos, guarda y custodia, convivencia.',
  },
  {
    id: 'fam.divorcio',
    materia: 'familiar',
    nombre: 'Divorcio',
    regimen: 'civil_familiar_local',
    fueros: ['comun'],
    descripcion: 'Incausado o por convenio, según la entidad.',
  },

  // ── Laboral ────────────────────────────────────────────────────────────────
  {
    id: 'lab.conciliacion',
    materia: 'laboral',
    nombre: 'Conciliación prejudicial',
    regimen: 'laboral',
    fueros: ['federal', 'comun'],
    descripcion:
      'Etapa obligatoria previa al juicio ante el Centro de Conciliación. Sin la constancia de no conciliación no se admite la demanda.',
  },
  {
    id: 'lab.ordinario',
    materia: 'laboral',
    nombre: 'Juicio ordinario laboral',
    regimen: 'laboral',
    fueros: ['federal', 'comun'],
    descripcion: 'Ante Tribunal Laboral, con audiencia preliminar y de juicio.',
  },

  // ── Amparo ─────────────────────────────────────────────────────────────────
  {
    id: 'amp.indirecto',
    materia: 'amparo',
    nombre: 'Amparo indirecto',
    regimen: 'amparo',
    fueros: ['federal'],
    descripcion:
      'Ante Juzgado de Distrito. Corre en paralelo el incidente de suspensión, que tiene sus propios plazos y audiencia.',
  },
  {
    id: 'amp.directo',
    materia: 'amparo',
    nombre: 'Amparo directo',
    regimen: 'amparo',
    fueros: ['federal'],
    descripcion:
      'Ante Tribunal Colegiado, pero se presenta por conducto de la autoridad responsable.',
  },

  // ── Administrativo y fiscal ────────────────────────────────────────────────
  {
    id: 'adm.nulidad_ordinaria',
    materia: 'administrativo',
    nombre: 'Juicio de nulidad — vía ordinaria',
    regimen: 'contencioso_administrativo',
    fueros: ['federal'],
    descripcion: 'Ante el Tribunal Federal de Justicia Administrativa.',
  },
  {
    id: 'adm.nulidad_sumaria',
    materia: 'administrativo',
    nombre: 'Juicio de nulidad — vía sumaria',
    regimen: 'contencioso_administrativo',
    fueros: ['federal'],
    descripcion:
      'Plazos más cortos que la ordinaria. Confundir la vía cuesta el asunto.',
  },
  {
    id: 'fis.revocacion',
    materia: 'fiscal',
    nombre: 'Recurso de revocación',
    regimen: 'fiscal_administrativo',
    fueros: ['federal'],
    descripcion: 'Recurso administrativo ante la propia autoridad fiscal.',
  },

  // ── Penal ──────────────────────────────────────────────────────────────────
  {
    id: 'pen.acusatorio',
    materia: 'penal',
    nombre: 'Procedimiento penal acusatorio',
    regimen: 'penal_acusatorio',
    fueros: ['federal', 'comun'],
    descripcion:
      'Carpeta de investigación, etapa inicial, intermedia y juicio oral. Muchos plazos corren en horas y esta herramienta no los calcula.',
  },

  // ── Corporativo ────────────────────────────────────────────────────────────
  {
    id: 'corp.asunto',
    materia: 'corporativo',
    nombre: 'Asunto corporativo o consultivo',
    regimen: 'civil_familiar_local',
    fueros: ['comun', 'federal'],
    descripcion:
      'Sin juicio: no computa plazos procesales, solo fechas comprometidas con el cliente.',
  },
]

export function viasDeMateria(materia: IdMateria): Via[] {
  return VIAS.filter((v) => v.materia === materia)
}

export function buscarVia(id: string): Via | null {
  return VIAS.find((v) => v.id === id) ?? null
}

/**
 * El régimen de cómputo aplicable a una vía.
 * @throws si la vía no existe: computar plazos con un régimen adivinado es peor
 *         que no computarlos.
 */
export function regimenDeVia(idVia: string): IdRegimen {
  const via = buscarVia(idVia)
  if (!via) throw new RangeError(`Vía desconocida: ${idVia}`)
  return via.regimen
}

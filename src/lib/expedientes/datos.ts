import 'server-only'

import { normalizarNombre } from '@/lib/conflictos/deteccion'
import type { RegistroExistente } from '@/lib/conflictos/deteccion'
import { clienteServidor } from '@/lib/supabase/server'
import type { EstadoExpediente, RelacionPersona, TipoPersonaDb } from '@/types/db'

/**
 * Acceso a datos de expedientes.
 *
 * Toda consulta corre con la sesión del usuario, así que la RLS aplica: no hay
 * un solo `despacho_id` filtrado a mano aquí que sea la única defensa. Aun así
 * se filtra explícitamente donde tiene sentido, porque una consulta que se
 * apoya solo en la política es una consulta que trae de más el día que la
 * política cambie.
 */

export interface ExpedienteEnLista {
  id: string
  numeroInterno: string
  numeroOrgano: string | null
  caratula: string
  materia: string
  via: string
  estado: EstadoExpediente
  etapaActual: string | null
  responsableNombre: string | null
  actualizadoEl: string
}

export async function listarExpedientes(
  despachoId: string,
): Promise<ExpedienteEnLista[]> {
  const supabase = await clienteServidor()

  const { data, error } = await supabase
    .from('expedientes')
    .select(
      'id, numero_interno, numero_organo, caratula, materia, via, estado, etapa_actual, actualizado_el, responsable_id, perfiles:responsable_id(nombre)',
    )
    .eq('despacho_id', despachoId)
    .order('actualizado_el', { ascending: false })

  if (error || !data) return []

  return data.map((fila) => {
    const perfil = Array.isArray(fila.perfiles) ? fila.perfiles[0] : fila.perfiles
    return {
      id: fila.id,
      numeroInterno: fila.numero_interno,
      numeroOrgano: fila.numero_organo,
      caratula: fila.caratula,
      materia: fila.materia,
      via: fila.via,
      estado: fila.estado,
      etapaActual: fila.etapa_actual,
      responsableNombre: perfil?.nombre ?? null,
      actualizadoEl: fila.actualizado_el,
    }
  })
}

export interface ParteDelExpediente {
  id: string
  personaId: string
  nombre: string
  rol: string
  esNuestraParte: boolean
  abogadoContrario: string | null
}

export interface EtapaDelExpediente {
  clave: string
  nombre: string
  descripcion: string | null
  orden: number
  paralela: boolean
  completadaEl: string | null
}

export interface ExpedienteCompleto extends ExpedienteEnLista {
  fuero: string
  entidad: string | null
  instancia: string | null
  cuantia: number | null
  notas: string | null
  restringido: boolean
  fechaInicio: string | null
  partes: ParteDelExpediente[]
  etapas: EtapaDelExpediente[]
}

export async function obtenerExpediente(
  id: string,
): Promise<ExpedienteCompleto | null> {
  const supabase = await clienteServidor()

  const { data, error } = await supabase
    .from('expedientes')
    .select(
      'id, numero_interno, numero_organo, caratula, materia, via, fuero, entidad, instancia, cuantia, notas, restringido, fecha_inicio, estado, etapa_actual, actualizado_el, responsable_id, perfiles:responsable_id(nombre)',
    )
    .eq('id', id)
    .maybeSingle()

  // `null` sin distinguir "no existe" de "no tienes acceso": la RLS ya filtró,
  // y decirle a alguien que el expediente existe pero no puede verlo es
  // filtrar la existencia de un asunto ajeno.
  if (error || !data) return null

  const [partes, etapas] = await Promise.all([
    supabase
      .from('expediente_partes')
      .select('id, persona_id, rol, es_nuestra_parte, abogado_contrario, personas:persona_id(nombre)')
      .eq('expediente_id', id),
    supabase
      .from('expediente_etapas')
      .select('clave, nombre, descripcion, orden, paralela, completada_el')
      .eq('expediente_id', id)
      .order('orden'),
  ])

  const perfil = Array.isArray(data.perfiles) ? data.perfiles[0] : data.perfiles

  return {
    id: data.id,
    numeroInterno: data.numero_interno,
    numeroOrgano: data.numero_organo,
    caratula: data.caratula,
    materia: data.materia,
    via: data.via,
    fuero: data.fuero,
    entidad: data.entidad,
    instancia: data.instancia,
    cuantia: data.cuantia,
    notas: data.notas,
    restringido: data.restringido,
    fechaInicio: data.fecha_inicio,
    estado: data.estado,
    etapaActual: data.etapa_actual,
    responsableNombre: perfil?.nombre ?? null,
    actualizadoEl: data.actualizado_el,
    partes: (partes.data ?? []).map((p) => {
      const persona = Array.isArray(p.personas) ? p.personas[0] : p.personas
      return {
        id: p.id,
        personaId: p.persona_id,
        nombre: persona?.nombre ?? '(sin nombre)',
        rol: p.rol,
        esNuestraParte: p.es_nuestra_parte,
        abogadoContrario: p.abogado_contrario,
      }
    }),
    etapas: (etapas.data ?? []).map((e) => ({
      clave: e.clave,
      nombre: e.nombre,
      descripcion: e.descripcion,
      orden: e.orden,
      paralela: e.paralela,
      completadaEl: e.completada_el,
    })),
  }
}

/**
 * El padrón del despacho con su contexto, listo para el cotejo de conflictos.
 *
 * Se arma con DOS consultas y se une en memoria en vez de un join anidado. Es
 * más código, pero no depende de los metadatos de relaciones —que hoy están
 * escritos a mano en `db.ts`— y deja explícito qué se trae.
 *
 * Una persona puede aparecer en varios expedientes; cada aparición es un
 * registro propio, porque el hallazgo tiene que decir EN QUÉ asunto figura.
 * Una persona sin expediente también entra: puede haberse capturado en un alta
 * que no se completó, y sigue siendo información del padrón.
 */
export async function padronParaConflictos(
  despachoId: string,
): Promise<RegistroExistente[]> {
  const supabase = await clienteServidor()

  const [personas, apariciones] = await Promise.all([
    supabase
      .from('personas')
      .select('id, nombre, rfc, relacion')
      .eq('despacho_id', despachoId),
    supabase
      .from('expediente_partes')
      .select('persona_id, expediente_id, expedientes:expediente_id(caratula, despacho_id)')
      .limit(5000),
  ])

  if (!personas.data) return []

  const porPersona = new Map<string, { expedienteId: string; caratula: string }[]>()
  for (const fila of apariciones.data ?? []) {
    const exp = Array.isArray(fila.expedientes)
      ? fila.expedientes[0]
      : fila.expedientes
    if (!exp || exp.despacho_id !== despachoId) continue

    const lista = porPersona.get(fila.persona_id) ?? []
    lista.push({ expedienteId: fila.expediente_id, caratula: exp.caratula })
    porPersona.set(fila.persona_id, lista)
  }

  const registros: RegistroExistente[] = []

  for (const persona of personas.data) {
    const apariciones = porPersona.get(persona.id)

    if (!apariciones || apariciones.length === 0) {
      registros.push({
        id: persona.id,
        nombre: persona.nombre,
        rfc: persona.rfc,
        relacion: comoRelacionDeConflicto(persona.relacion),
        expedienteId: '',
        caratula: 'sin expediente asociado',
      })
      continue
    }

    for (const ap of apariciones) {
      registros.push({
        id: persona.id,
        nombre: persona.nombre,
        rfc: persona.rfc,
        relacion: comoRelacionDeConflicto(persona.relacion),
        expedienteId: ap.expedienteId,
        caratula: ap.caratula,
      })
    }
  }

  return registros
}

/**
 * El padrón guarda cuatro relaciones; el motor de conflictos razona sobre
 * tres. Un `tercero` se trata como contraparte: no es cliente, y para efectos
 * de la revisión eso es lo que importa.
 */
function comoRelacionDeConflicto(
  relacion: RelacionPersona,
): RegistroExistente['relacion'] {
  return relacion === 'tercero' ? 'contraparte' : relacion
}

export interface PersonaNueva {
  nombre: string
  tipo: TipoPersonaDb
  rfc: string | null
  relacion: RelacionPersona
}

/**
 * Devuelve el id de la persona, reutilizándola si ya está en el padrón.
 *
 * Se coteja por `nombre_cotejo` —la forma normalizada, sin acentos ni sufijo
 * societario— y no por el nombre literal. Sin eso, "Constructora XYZ, S.A. de
 * C.V." y "CONSTRUCTORA XYZ SA DE CV" quedarían como dos personas distintas y
 * el padrón se llenaría de duplicados que además rompen la detección de
 * conflictos.
 */
export async function buscarOCrearPersona(
  despachoId: string,
  persona: PersonaNueva,
): Promise<string | null> {
  const supabase = await clienteServidor()
  const cotejo = normalizarNombre(persona.nombre)

  const { data: existente } = await supabase
    .from('personas')
    .select('id')
    .eq('despacho_id', despachoId)
    .eq('nombre_cotejo', cotejo)
    .limit(1)
    .maybeSingle()

  if (existente) return existente.id

  const { data, error } = await supabase
    .from('personas')
    .insert({
      despacho_id: despachoId,
      nombre: persona.nombre.trim(),
      nombre_cotejo: cotejo,
      tipo: persona.tipo,
      rfc: persona.rfc,
      relacion: persona.relacion,
    })
    .select('id')
    .single()

  if (error || !data) return null
  return data.id
}

/** Quién puede quedar como responsable de un expediente. */
export interface MiembroDelDespacho {
  perfilId: string
  nombre: string
  rol: string
}

export async function miembrosDelDespacho(
  despachoId: string,
): Promise<MiembroDelDespacho[]> {
  const supabase = await clienteServidor()

  const { data } = await supabase
    .from('membresias')
    .select('perfil_id, rol, perfiles:perfil_id(nombre, correo)')
    .eq('despacho_id', despachoId)
    .eq('estado', 'activa')
    .neq('rol', 'cliente')

  return (data ?? []).flatMap((fila) => {
    const perfil = Array.isArray(fila.perfiles) ? fila.perfiles[0] : fila.perfiles
    if (!perfil) return []
    return [
      {
        perfilId: fila.perfil_id,
        nombre: perfil.nombre || perfil.correo || 'Sin nombre',
        rol: fila.rol,
      },
    ]
  })
}

'use server'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import {
  revisarConflictos,
  type ParteEnEstudio,
} from '@/lib/conflictos/deteccion'
import {
  buscarOCrearPersona,
  contarPlazosPendientes,
  miembrosDelDespacho,
  obtenerExpediente,
  padronParaConflictos,
} from '@/lib/expedientes/datos'
import {
  anotacionDeCambios,
  cambiosDeEdicion,
  edicionDesde,
  leerEdicion,
  normalizarEdicion,
  validarEdicion,
} from '@/lib/expedientes/edicion'
import { ROL_ETIQUETA, type RolParte } from '@/lib/expedientes/partes'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import { clienteServidor } from '@/lib/supabase/server'
import type { RelacionPersona, TipoPersonaDb } from '@/types/db'

import type { HallazgoVisible } from '../../nuevo/estado'
import {
  edicionConError,
  edicionConProblemas,
  edicionGuardada,
  parteConConflictos,
  parteConError,
  parteConProblemas,
  type EstadoEdicion,
  type EstadoParte,
} from './estado'

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

/**
 * Guarda los cambios del expediente y anota en la bitácora los que importan.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL "ANTES" SE RELEE, NO VIENE DEL FORMULARIO
 * ─────────────────────────────────────────────────────────────────────────────
 * El comparativo que va a la bitácora se arma contra la fila que está en la
 * base ahora mismo. Si el "antes" viniera de un campo oculto, dos personas
 * editando el mismo asunto dejarían anotaciones que dicen que se cambió algo
 * que ya había cambiado otro — y la bitácora es lo único que no se puede
 * corregir después.
 */
export async function guardarExpediente(
  _previo: EstadoEdicion,
  formData: FormData,
): Promise<EstadoEdicion> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const expedienteId = campos.expedienteId ?? ''

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) return edicionConError(campos, 'No se encontró el expediente.')

  const hoy = hoyEnMexico()
  const captura = normalizarEdicion(leerEdicion(campos), hoy)

  const problemasCaptura = validarEdicion(captura, {
    hoy,
    etapas: expediente.etapas,
    plazosPendientes: await contarPlazosPendientes(expedienteId),
  })
  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return edicionConProblemas(campos, problemas)
  }

  const antes = edicionDesde({
    numeroOrgano: expediente.numeroOrgano,
    instancia: expediente.instancia,
    entidad: expediente.entidad,
    cuantia: expediente.cuantia,
    responsableId: expediente.responsableId,
    restringido: expediente.restringido,
    notas: expediente.notas,
    estado: expediente.estado,
    resultado: expediente.resultado,
    fechaConclusion: expediente.fechaConclusion,
    etapaActual: expediente.etapaActual,
  })

  const miembros = await miembrosDelDespacho(sesion.activa.despachoId)
  const cambios = cambiosDeEdicion(antes, captura, {
    personas: Object.fromEntries(miembros.map((m) => [m.perfilId, m.nombre])),
    etapas: Object.fromEntries(expediente.etapas.map((e) => [e.clave, e.nombre])),
  })

  if (cambios.length === 0) {
    return edicionGuardada('No había nada que cambiar.')
  }

  const supabase = await clienteServidor()

  const { error } = await supabase
    .from('expedientes')
    .update({
      numero_organo: captura.numeroOrgano,
      instancia: captura.instancia,
      entidad: captura.entidad,
      cuantia: captura.cuantia,
      responsable_id: captura.responsableId,
      restringido: captura.restringido,
      notas: captura.notas,
      estado: captura.estado,
      resultado: captura.resultado,
      fecha_conclusion: captura.fechaConclusion,
      etapa_actual: captura.etapaActual,
    })
    .eq('id', expedienteId)

  if (error) {
    return edicionConError(
      campos,
      'No se pudo guardar. Nada cambió; vuelve a intentarlo.',
    )
  }

  // La anotación va DESPUÉS de guardar: si se asentara antes y el guardado
  // fallara, la bitácora afirmaría un cambio que no ocurrió — y no se puede
  // borrar. Al revés, lo peor que pasa es un cambio sin su anotación, que se
  // ve en la pantalla y se puede rectificar con otra actuación.
  const anotacion = anotacionDeCambios(cambios)
  if (anotacion) {
    await supabase.from('actuaciones').insert({
      expediente_id: expedienteId,
      tipo: 'nota_interna',
      fecha: hoy,
      titulo: anotacion.titulo,
      detalle: anotacion.detalle,
      etapa_clave: anotacion.etapaClave,
      visible_cliente: false,
      creado_por: sesion.usuarioId,
    })
  }

  revalidatePath(`/panel/expedientes/${expedienteId}`)
  revalidatePath('/panel')

  const n = cambios.length
  return edicionGuardada(
    `Guardado: ${n} ${n === 1 ? 'cambio' : 'cambios'}${anotacion ? ', anotado en la bitácora' : ''}.`,
  )
}

/**
 * Agrega una parte a un expediente ya abierto.
 *
 * ⚠️ **Vuelve a correr el cotejo de conflictos.** Una parte que entra a mitad
 * del juicio —un tercero llamado a juicio, un codemandado que apareció en la
 * contestación— puede ser cliente del despacho en otro asunto, y ese es
 * exactamente el impedimento que hay que detectar antes de seguir
 * representando. Revisar solo al abrir el expediente dejaría ciego justo el
 * caso que llega por sorpresa.
 */
export async function agregarParte(
  _previo: EstadoParte,
  formData: FormData,
): Promise<EstadoParte> {
  const sesion = await exigirPanel()
  const despachoId = sesion.activa.despachoId
  const campos = comoCampos(formData)
  const expedienteId = campos.expedienteId ?? ''

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) return parteConError(campos, 'No se encontró el expediente.')

  const nombre = campos.nombre?.trim() ?? ''
  const rol = campos.rol?.trim() ?? ''
  const rfc = campos.rfc?.trim() || null
  const tipo: TipoPersonaDb = campos.tipo === 'moral' ? 'moral' : 'fisica'
  const esNuestraParte = campos.esNuestraParte === 'on'
  const abogadoContrario = campos.abogadoContrario?.trim() || null

  const problemas: Record<string, string> = {}
  if (nombre.length < 3) problemas.nombre = 'Escribe el nombre completo.'
  if (!ROL_ETIQUETA[rol as RolParte]) problemas.rol = 'Elige el carácter con el que comparece.'
  if (Object.keys(problemas).length > 0) return parteConProblemas(campos, problemas)

  const enEstudio: ParteEnEstudio[] = [{ nombre, rfc, esNuestraParte }]
  const revision = revisarConflictos({
    partes: enEstudio,
    padron: await padronParaConflictos(despachoId),
  })

  if (revision.requiereConstancia && campos.conflictoRevisado !== 'on') {
    const visibles: HallazgoVisible[] = revision.hallazgos.map((h) => ({
      nivel: h.nivel,
      coincidencia: h.coincidencia,
      nombreParte: h.parte.nombre,
      nombreRegistro: h.registro.nombre,
      caratula: h.registro.caratula,
      motivo: h.motivo,
    }))
    return parteConConflictos(campos, visibles)
  }

  const relacion: RelacionPersona = esNuestraParte ? 'cliente_activo' : 'contraparte'
  const personaId = await buscarOCrearPersona(despachoId, {
    nombre,
    tipo,
    rfc,
    relacion,
  })
  if (!personaId) return parteConError(campos, 'No se pudo guardar a la persona en el padrón.')

  const supabase = await clienteServidor()

  const { error } = await supabase.from('expediente_partes').insert({
    expediente_id: expedienteId,
    persona_id: personaId,
    rol,
    es_nuestra_parte: esNuestraParte,
    abogado_contrario: abogadoContrario,
  })

  if (error) {
    return parteConError(
      campos,
      'No se pudo agregar la parte. Puede que ya esté en el expediente con ese mismo carácter.',
    )
  }

  await supabase.from('actuaciones').insert({
    expediente_id: expedienteId,
    tipo: 'nota_interna',
    fecha: hoyEnMexico(),
    titulo: `Se agregó una parte: ${nombre}`,
    detalle: revision.requiereConstancia
      ? `Comparece como ${ROL_ETIQUETA[rol as RolParte]}.\n\nEl cotejo de conflicto de interés arrojó ${revision.hallazgos.length} coincidencia(s) y ${sesion.nombre || sesion.correo} decidió continuar.\n\n${revision.hallazgos.map((h) => `· ${h.registro.nombre} (${h.registro.caratula}) — ${h.motivo}`).join('\n')}`
      : `Comparece como ${ROL_ETIQUETA[rol as RolParte]}. El cotejo de conflicto de interés no arrojó coincidencias.`,
    visible_cliente: false,
    creado_por: sesion.usuarioId,
  })

  revalidatePath(`/panel/expedientes/${expedienteId}`)

  return {
    valores: {},
    error: null,
    problemas: {},
    conflictos: null,
    guardado: `${nombre} quedó agregada como ${ROL_ETIQUETA[rol as RolParte]}.`,
  }
}

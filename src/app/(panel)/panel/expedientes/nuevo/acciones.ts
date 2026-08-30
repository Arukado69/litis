'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { exigirPanel } from '@/lib/auth/sesion'
import {
  revisarConflictos,
  type ParteEnEstudio,
} from '@/lib/conflictos/deteccion'
import { prepararApertura, type ParteCaptura } from '@/lib/expedientes/apertura'
import { leerCaptura, validarCaptura } from '@/lib/expedientes/captura'
import {
  buscarOCrearPersona,
  padronParaConflictos,
} from '@/lib/expedientes/datos'
import { clienteServidor } from '@/lib/supabase/server'
import type { RelacionPersona } from '@/types/db'

import {
  conConflictos,
  conError,
  conProblemas,
  type EstadoAlta,
  type HallazgoVisible,
} from './estado'

/** Todo lo que llega del formulario, como texto. */
function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

/**
 * Abre un expediente.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ORDEN DE LOS PASOS NO ES CASUAL
 * ─────────────────────────────────────────────────────────────────────────────
 * El cotejo de conflictos va ANTES de crear a las personas. Si se crearan
 * primero, cada persona nueva se encontraría a sí misma en el padrón y toda
 * alta reportaría un conflicto consigo misma — la alerta perdería todo valor
 * en el primer uso.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA CONSTANCIA VA EN LA BITÁCORA
 * ─────────────────────────────────────────────────────────────────────────────
 * Cuando hubo hallazgos y alguien decidió seguir adelante, eso se asienta como
 * una actuación del expediente. La bitácora es inmutable, así que queda quién
 * revisó, cuándo y qué se le mostró. Es exactamente lo que hace falta el día
 * que haya que sostener que el conflicto se valoró y se descartó con razón.
 */
export async function abrirExpediente(
  _previo: EstadoAlta,
  formData: FormData,
): Promise<EstadoAlta> {
  const sesion = await exigirPanel()
  const despachoId = sesion.activa.despachoId

  const campos = comoCampos(formData)
  const captura = leerCaptura(campos)

  const problemasCaptura = validarCaptura(captura)
  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return conProblemas(campos, problemas)
  }

  // ── 1. Conflicto de interés, sobre los nombres tecleados ─────────────────
  const enEstudio: ParteEnEstudio[] = [
    {
      nombre: captura.nuestraParte.nombre,
      rfc: captura.nuestraParte.rfc,
      esNuestraParte: true,
    },
  ]
  if (captura.contraparte) {
    enEstudio.push({
      nombre: captura.contraparte.nombre,
      rfc: captura.contraparte.rfc,
      esNuestraParte: false,
    })
  }

  const revision = revisarConflictos({
    partes: enEstudio,
    padron: await padronParaConflictos(despachoId),
  })

  const yaRevisado = campos.conflictoRevisado === 'on'

  if (revision.requiereConstancia && !yaRevisado) {
    const visibles: HallazgoVisible[] = revision.hallazgos.map((h) => ({
      nivel: h.nivel,
      coincidencia: h.coincidencia,
      nombreParte: h.parte.nombre,
      nombreRegistro: h.registro.nombre,
      caratula: h.registro.caratula,
      motivo: h.motivo,
    }))
    return conConflictos(campos, visibles)
  }

  // ── 2. Personas del padrón ───────────────────────────────────────────────
  const relacionCliente: RelacionPersona = 'cliente_activo'

  const clienteId = await buscarOCrearPersona(despachoId, {
    nombre: captura.nuestraParte.nombre,
    tipo: captura.nuestraParte.tipo,
    rfc: captura.nuestraParte.rfc,
    relacion: relacionCliente,
  })
  if (!clienteId) {
    return conError(campos, 'No se pudo guardar al cliente en el padrón.')
  }

  let contraparteId: string | null = null
  if (captura.contraparte) {
    contraparteId = await buscarOCrearPersona(despachoId, {
      nombre: captura.contraparte.nombre,
      tipo: captura.contraparte.tipo,
      rfc: captura.contraparte.rfc,
      relacion: 'contraparte',
    })
    if (!contraparteId) {
      return conError(campos, 'No se pudo guardar a la contraparte en el padrón.')
    }
  }

  // ── 3. Plan de apertura ──────────────────────────────────────────────────
  const partes: ParteCaptura[] = [
    {
      personaId: clienteId,
      nombre: captura.nuestraParte.nombre,
      rol: captura.nuestraParte.rol,
      esNuestraParte: true,
    },
  ]
  if (captura.contraparte && contraparteId) {
    partes.push({
      personaId: contraparteId,
      nombre: captura.contraparte.nombre,
      rol: captura.contraparte.rol,
      esNuestraParte: false,
      abogadoContrario: captura.contraparte.abogadoContrario,
    })
  }

  const preparado = prepararApertura({
    despachoId,
    materia: captura.materia,
    via: captura.via,
    fuero: captura.fuero,
    entidad: captura.entidad,
    organoId: captura.organoId,
    numeroOrgano: captura.numeroOrgano,
    clientePersonaId: clienteId,
    responsableId: captura.responsableId,
    caratula: captura.caratula,
    instancia: captura.instancia,
    cuantia: captura.cuantia,
    restringido: captura.restringido,
    fechaInicio: captura.fechaInicio,
    notas: captura.notas,
    partes,
  })

  if (!preparado.ok) {
    const problemas: Record<string, string> = {}
    for (const p of preparado.problemas) problemas[p.campo] ??= p.mensaje
    return conProblemas(campos, problemas)
  }

  const { plan } = preparado
  const supabase = await clienteServidor()

  // ── 4. Escritura atómica ─────────────────────────────────────────────────
  const { data: expedienteId, error } = await supabase.rpc('abrir_expediente', {
    p_despacho_id: plan.expediente.despachoId,
    p_caratula: plan.expediente.caratula,
    p_materia: plan.expediente.materia,
    p_via: plan.expediente.via,
    p_fuero: plan.expediente.fuero,
    p_partes: plan.partes.map((p) => ({
      persona_id: p.personaId,
      rol: p.rol,
      es_nuestra_parte: p.esNuestraParte,
      abogado_contrario: p.abogadoContrario ?? null,
      notas: p.notas ?? null,
    })),
    p_etapas: plan.etapas.map((e) => ({
      clave: e.clave,
      nombre: e.nombre,
      descripcion: e.descripcion,
      orden: e.orden,
      paralela: e.paralela,
    })),
    p_etapa_actual: plan.expediente.etapaActual,
    p_cliente_persona_id: plan.expediente.clientePersonaId,
    p_entidad: plan.expediente.entidad,
    p_organo_id: plan.expediente.organoId,
    p_numero_organo: plan.expediente.numeroOrgano,
    p_instancia: plan.expediente.instancia,
    p_cuantia: plan.expediente.cuantia,
    p_responsable_id: plan.expediente.responsableId,
    p_restringido: plan.expediente.restringido,
    p_fecha_inicio: plan.expediente.fechaInicio,
    p_notas: plan.expediente.notas,
  })

  if (error || !expedienteId) {
    return conError(
      campos,
      'No se pudo abrir el expediente. Vuelve a intentar en un momento.',
    )
  }

  // ── 5. Constancia de la revisión de conflictos ───────────────────────────
  if (revision.requiereConstancia) {
    const resumen = revision.hallazgos
      .map((h) => `· ${h.registro.nombre} (${h.nivel}) — ${h.motivo}`)
      .join('\n')

    // Sin `await` en el sentido de bloquear el flujo si falla: el expediente ya
    // existe y no vale perderlo por no poder escribir la nota. Pero sí se
    // espera, para que quede antes de redirigir.
    await supabase.from('actuaciones').insert({
      expediente_id: expedienteId,
      tipo: 'nota_interna',
      fecha: new Date().toISOString().slice(0, 10),
      titulo: 'Revisión de conflicto de interés',
      detalle: `Se detectaron ${revision.hallazgos.length} coincidencia(s) y ${sesion.nombre || sesion.correo} decidió continuar.\n\n${resumen}`,
      visible_cliente: false,
    })
  }

  revalidatePath('/panel/expedientes')
  redirect(`/panel/expedientes/${expedienteId}`)
}

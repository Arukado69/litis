'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { exigirPanel } from '@/lib/auth/sesion'
import { obtenerExpediente } from '@/lib/expedientes/datos'
import { regimenDeVia } from '@/lib/expedientes/materias'
import { calendarioDelExpediente, catalogoDeRegimen } from '@/lib/plazos/carga'
import { computarPlazo } from '@/lib/plazos/computo'
import { esFechaISO, hoyEnMexico } from '@/lib/plazos/fecha'
import {
  advertenciasDelRegistro,
  leerNotificacion,
  resolverPlazo,
  validarNotificacion,
} from '@/lib/plazos/registro'
import { UNIDAD_ETIQUETA } from '@/lib/plazos/regimenes'
import { clienteServidor } from '@/lib/supabase/server'

import {
  conError,
  conProblemas,
  conVista,
  type EstadoNotificacion,
  type VistaPrevia,
} from './estado'

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

/**
 * Registra una notificación y computa su plazo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS PASOS, SIEMPRE
 * ─────────────────────────────────────────────────────────────────────────────
 * El primer envío CALCULA y devuelve la traza; no guarda nada. El segundo —con
 * la casilla de confirmación— guarda. No es un paso de más: la herramienta
 * propone y el abogado confirma, y esa secuencia es justo lo que hace que la
 * responsabilidad quede donde debe estar.
 *
 * En el segundo paso se puede ajustar la fecha a mano. El motor no conoce el
 * acuerdo que habilitó días y horas ni la suspensión que decretó el juez ayer.
 * Un sistema que no deja corregir obliga a llevar el plazo bueno en un papel
 * aparte, y entonces el sistema sobra. Pero ajustar EXIGE motivo, y la base lo
 * fuerza con un `check`.
 */
export async function registrarNotificacion(
  _previo: EstadoNotificacion,
  formData: FormData,
): Promise<EstadoNotificacion> {
  await exigirPanel()

  const campos = comoCampos(formData)
  const expedienteId = campos.expedienteId ?? ''

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) {
    return conError(campos, 'No se encontró el expediente.')
  }

  const captura = leerNotificacion(campos)
  const hoy = hoyEnMexico()

  const problemasCaptura = validarNotificacion(captura, hoy)
  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return conProblemas(campos, problemas)
  }

  // La vía determina el régimen, y el régimen determina cuándo surte efectos
  // la notificación. Sin vía válida no hay cómputo posible.
  let regimen
  try {
    regimen = regimenDeVia(expediente.via)
  } catch {
    return conError(
      campos,
      'La vía del expediente no está reconocida, así que no se puede computar el plazo. Corrígela antes de registrar la notificación.',
    )
  }

  const [{ calendario, esPorOmision }, catalogo] = await Promise.all([
    calendarioDelExpediente({ organoId: expediente.organoId, regimen }),
    catalogoDeRegimen(regimen),
  ])

  if (!calendario) {
    return conError(
      campos,
      'No hay un calendario de días inhábiles cargado. Aplica la migración de semilla o captura uno antes de computar plazos.',
    )
  }

  let plazo
  try {
    plazo = resolverPlazo(captura, catalogo)
  } catch {
    return conError(campos, 'El plazo elegido ya no está en el catálogo.')
  }

  if (!captura.fechaNotificacion) {
    return conProblemas(campos, {
      fechaNotificacion: 'Captura la fecha de la notificación.',
    })
  }

  const resultado = computarPlazo({
    regimen,
    tipoNotificacion: captura.tipoNotificacion,
    fechaNotificacion: captura.fechaNotificacion,
    dias: plazo.dias,
    unidad: plazo.unidad,
    calendario,
    etiqueta: plazo.etiqueta,
    fundamentoPlazo: plazo.fundamento ?? undefined,
    diasPorDistancia: captura.diasDistancia,
  })

  const advertencias = [
    ...resultado.advertencias,
    ...advertenciasDelRegistro(captura, plazo, regimen),
  ]
  if (esPorOmision) {
    advertencias.push(
      `Se usó el calendario "${calendario.nombre}" porque el expediente no tiene órgano con calendario propio. Los periodos vacacionales de un tribunal local no coinciden con los del PJF: verifica antes de confiar en la fecha.`,
    )
  }

  // ── Paso 1: enseñar el cómputo ───────────────────────────────────────────
  if (campos.confirmado !== 'on') {
    const vista: VistaPrevia = {
      etiqueta: plazo.etiqueta,
      fechaNotificacion: resultado.fechaNotificacion,
      fechaSurteEfectos: resultado.fechaSurteEfectos,
      primerDia: resultado.primerDia,
      fechaVencimiento: resultado.fechaVencimiento,
      diasDelPlazo: resultado.diasDelPlazo,
      unidad: UNIDAD_ETIQUETA[resultado.unidad],
      pasos: resultado.pasos.map((p) => ({
        orden: p.orden,
        titulo: p.titulo,
        detalle: p.detalle,
        fecha: p.fecha ?? null,
        fundamento: p.fundamento ?? null,
      })),
      diasOmitidos: resultado.diasOmitidos.map((d) => ({
        fecha: d.fecha,
        descripcion: d.descripcion,
      })),
      advertencias: [...new Set(advertencias)],
      fundamentos: [...resultado.fundamentos],
      confiabilidad: resultado.confiabilidad,
      coberturaCompleta: resultado.coberturaCompleta,
      calendarioNombre: calendario.nombre,
      calendarioPorOmision: esPorOmision,
    }
    return conVista(campos, vista)
  }

  // ── Paso 2: guardar ──────────────────────────────────────────────────────
  const ajuste = campos.fechaAjustada?.trim()
  const motivoAjuste = campos.motivoAjuste?.trim()

  if (ajuste && ajuste !== resultado.fechaVencimiento) {
    if (!esFechaISO(ajuste)) {
      return conProblemas(campos, {
        fechaAjustada: 'La fecha ajustada no es válida.',
      })
    }
    if (!motivoAjuste) {
      // Lo exige también un `check` en la base; se valida aquí para dar un
      // mensaje decente en vez de un error de Postgres.
      return conProblemas(campos, {
        motivoAjuste: 'Si cambias la fecha, escribe por qué.',
      })
    }
  }

  const supabase = await clienteServidor()
  const sesion = await exigirPanel()

  // La notificación es un hecho del expediente: va a la bitácora aunque el
  // plazo fallara después.
  const { data: actuacion } = await supabase
    .from('actuaciones')
    .insert({
      expediente_id: expedienteId,
      tipo: 'notificacion',
      fecha: captura.fechaNotificacion,
      titulo: `Notificación ${captura.tipoNotificacion} — ${plazo.etiqueta}`,
      detalle: captura.detalle,
      visible_cliente: false,
    })
    .select('id')
    .single()

  const hayAjuste = Boolean(ajuste && ajuste !== resultado.fechaVencimiento)

  const { error } = await supabase.from('plazos').insert({
    expediente_id: expedienteId,
    etiqueta: plazo.etiqueta,
    plazo_catalogo_id: plazo.catalogoId,
    regimen,
    dias: plazo.dias,
    unidad: plazo.unidad,
    dias_distancia: captura.diasDistancia,
    actuacion_id: actuacion?.id ?? null,
    tipo_notificacion: captura.tipoNotificacion,
    fecha_notificacion: resultado.fechaNotificacion,
    calendario_id: calendario.id,
    fecha_surte_efectos: resultado.fechaSurteEfectos,
    primer_dia: resultado.primerDia,
    fecha_vencimiento: resultado.fechaVencimiento,
    fecha_vencimiento_ajustada: hayAjuste ? ajuste : null,
    motivo_ajuste: hayAjuste ? motivoAjuste : null,
    ajustado_por: hayAjuste ? sesion.usuarioId : null,
    ajustado_el: hayAjuste ? new Date().toISOString() : null,
    // La traza completa, para poder auditar el cómputo dentro de seis meses.
    computo: {
      pasos: resultado.pasos,
      diasContados: resultado.diasContados,
      diasOmitidos: resultado.diasOmitidos,
      fundamentos: resultado.fundamentos,
      advertencias,
      calendario: { id: calendario.id, nombre: calendario.nombre },
      coberturaCompleta: resultado.coberturaCompleta,
    },
    confiabilidad: resultado.confiabilidad,
    responsable_id: captura.responsableId,
  })

  if (error) {
    return conError(
      campos,
      'La notificación quedó asentada en la bitácora, pero el PLAZO no se guardó. Vuelve a registrarlo: sin él no habrá aviso de vencimiento.',
    )
  }

  revalidatePath(`/panel/expedientes/${expedienteId}`)
  redirect(`/panel/expedientes/${expedienteId}`)
}

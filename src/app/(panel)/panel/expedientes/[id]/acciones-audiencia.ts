'use server'

import { revalidatePath } from 'next/cache'

import {
  advertenciasDeAudiencia,
  anotacionDeDiferimiento,
  leerAudiencia,
  leerDiferimiento,
  validarAudiencia,
  validarCelebracion,
  validarDiferimiento,
} from '@/lib/audiencias/audiencias'
import { exigirPanel } from '@/lib/auth/sesion'
import { obtenerExpediente } from '@/lib/expedientes/datos'
import { clienteServidor } from '@/lib/supabase/server'

import type { EstadoAudiencia } from './estado-audiencia'

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

function conError(campos: Record<string, string>, error: string): EstadoAudiencia {
  return { valores: campos, error, problemas: {}, advertencias: [], guardado: null }
}

/**
 * Señala una audiencia.
 *
 * ⚠️ **Lo que falta advierte pero no bloquea.** Una audiencia se señala con lo
 * que dice el acuerdo, y a veces el acuerdo trae el día pero no la hora, o
 * todavía no se decide quién va. Exigirlo todo obligaría a anotarla en un papel
 * aparte mientras tanto — y un sistema al que se le anota aparte sobra.
 *
 * La advertencia que importa es la del responsable: una audiencia sin
 * responsable es una audiencia a la que no va nadie.
 */
export async function señalarAudiencia(
  _previo: EstadoAudiencia,
  formData: FormData,
): Promise<EstadoAudiencia> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const expedienteId = campos.expedienteId ?? ''

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) return conError(campos, 'No se encontró el expediente.')

  const captura = leerAudiencia(campos)
  const problemasCaptura = validarAudiencia(captura)

  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return { valores: campos, error: null, problemas, advertencias: [], guardado: null }
  }

  // `validarAudiencia` ya exigió la fecha; el compilador no lo sabe.
  if (!captura.fecha) {
    return {
      valores: campos,
      error: null,
      problemas: { fecha: 'Captura la fecha señalada.' },
      advertencias: [],
      guardado: null,
    }
  }

  const supabase = await clienteServidor()
  const { error } = await supabase.from('audiencias').insert({
    expediente_id: expedienteId,
    tipo: captura.tipo,
    fecha: captura.fecha,
    hora: captura.hora,
    lugar: captura.lugar,
    responsable_id: captura.responsableId,
    notas: captura.notas,
    visible_cliente: captura.visibleCliente,
    creado_por: sesion.usuarioId,
  })

  if (error) return conError(campos, 'No se pudo guardar la audiencia.')

  revalidatePath(`/panel/expedientes/${expedienteId}`)
  revalidatePath('/panel/agenda')
  revalidatePath('/panel')

  return {
    valores: {},
    error: null,
    problemas: {},
    advertencias: advertenciasDeAudiencia(captura),
    guardado: `Quedó señalada para el ${captura.fecha}.`,
  }
}

/**
 * Difiere una audiencia: deja la vieja asentada y crea la nueva.
 *
 * ⚠️ **No se le cambia la fecha encima.** El día señalado OCURRIÓ como hecho:
 * se fue al juzgado, se esperó y se difirió. Borrar ese día del expediente
 * borraría algo que se cobra, que se le explica al cliente y que a veces
 * explica por qué un plazo corrió distinto.
 */
export async function diferirAudiencia(
  _previo: EstadoAudiencia,
  formData: FormData,
): Promise<EstadoAudiencia> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const audienciaId = campos.audienciaId ?? ''

  const supabase = await clienteServidor()

  const { data: vieja } = await supabase
    .from('audiencias')
    .select('id, expediente_id, tipo, fecha, hora, lugar, responsable_id, estado, visible_cliente')
    .eq('id', audienciaId)
    .maybeSingle()

  if (!vieja) return conError(campos, 'No se encontró la audiencia.')
  if (vieja.estado !== 'programada') {
    return conError(campos, 'Esa audiencia ya no está programada.')
  }

  const captura = leerDiferimiento(campos)
  const problemasCaptura = validarDiferimiento(captura, vieja.fecha)

  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return { valores: campos, error: null, problemas, advertencias: [], guardado: null }
  }

  // Igual que arriba: `validarDiferimiento` ya la exigió.
  if (!captura.fechaNueva) {
    return conError(campos, 'Captura la fecha para la que se difirió.')
  }

  const anotacion = anotacionDeDiferimiento(vieja.tipo, vieja.fecha, captura)

  // La vieja se marca diferida CON su motivo. No se toca su fecha.
  const { error: errorVieja } = await supabase
    .from('audiencias')
    .update({ estado: 'diferida', resultado: captura.motivo })
    .eq('id', vieja.id)
    .eq('estado', 'programada')

  if (errorVieja) return conError(campos, 'No se pudo marcar como diferida.')

  const { error: errorNueva } = await supabase.from('audiencias').insert({
    expediente_id: vieja.expediente_id,
    tipo: vieja.tipo,
    fecha: captura.fechaNueva,
    // Si no dan hora nueva, se conserva la que traía: casi siempre es la misma.
    hora: captura.hora ?? vieja.hora,
    lugar: vieja.lugar,
    responsable_id: vieja.responsable_id,
    visible_cliente: vieja.visible_cliente,
    creado_por: sesion.usuarioId,
  })

  if (errorNueva) {
    return conError(
      campos,
      'La audiencia quedó marcada como diferida, pero la nueva NO se creó. Señálala a mano.',
    )
  }

  await supabase.from('actuaciones').insert({
    expediente_id: vieja.expediente_id,
    tipo: 'audiencia',
    fecha: vieja.fecha,
    titulo: anotacion.titulo,
    detalle: anotacion.detalle,
    visible_cliente: true,
    creado_por: sesion.usuarioId,
  })

  revalidatePath(`/panel/expedientes/${vieja.expediente_id}`)
  revalidatePath('/panel/agenda')
  revalidatePath('/panel')

  return {
    valores: {},
    error: null,
    problemas: {},
    advertencias: [],
    guardado: `Se difirió al ${captura.fechaNueva}. La fecha anterior quedó en la bitácora.`,
  }
}

/**
 * Marca una audiencia como celebrada.
 *
 * Exige decir qué pasó: eso ES la audiencia. Sin el resultado, en el expediente
 * queda un día en blanco que nadie va a poder reconstruir.
 */
export async function celebrarAudiencia(
  _previo: EstadoAudiencia,
  formData: FormData,
): Promise<EstadoAudiencia> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const audienciaId = campos.audienciaId ?? ''
  const resultado = campos.resultado?.trim() ?? null

  const problemasCaptura = validarCelebracion({ resultado })
  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return { valores: campos, error: null, problemas, advertencias: [], guardado: null }
  }

  const supabase = await clienteServidor()

  const { data: audiencia } = await supabase
    .from('audiencias')
    .select('id, expediente_id, tipo, fecha, estado')
    .eq('id', audienciaId)
    .maybeSingle()

  if (!audiencia) return conError(campos, 'No se encontró la audiencia.')
  if (audiencia.estado !== 'programada') {
    return conError(campos, 'Esa audiencia ya se había cerrado.')
  }

  const { error } = await supabase
    .from('audiencias')
    .update({ estado: 'celebrada', resultado })
    .eq('id', audiencia.id)
    .eq('estado', 'programada')

  if (error) return conError(campos, 'No se pudo guardar. Vuelve a intentarlo.')

  // Lo que pasó en la audiencia va a la bitácora, fechado el día en que
  // ocurrió: es de lo más consultado de un expediente.
  await supabase.from('actuaciones').insert({
    expediente_id: audiencia.expediente_id,
    tipo: 'audiencia',
    fecha: audiencia.fecha,
    titulo: `Se celebró la ${audiencia.tipo.toLowerCase()}`,
    detalle: resultado,
    visible_cliente: true,
    creado_por: sesion.usuarioId,
  })

  revalidatePath(`/panel/expedientes/${audiencia.expediente_id}`)
  revalidatePath('/panel/agenda')
  revalidatePath('/panel')

  return {
    valores: {},
    error: null,
    problemas: {},
    advertencias: [],
    guardado: `Quedó asentada en la bitácora del ${audiencia.fecha}.`,
  }
}

/** Cancela una audiencia que ya no va a celebrarse. */
export async function cancelarAudiencia(formData: FormData): Promise<void> {
  await exigirPanel()
  const audienciaId = formData.get('audienciaId')
  if (typeof audienciaId !== 'string' || audienciaId.length === 0) return

  const supabase = await clienteServidor()
  const { data } = await supabase
    .from('audiencias')
    .select('expediente_id')
    .eq('id', audienciaId)
    .maybeSingle()

  await supabase
    .from('audiencias')
    .update({ estado: 'cancelada' })
    .eq('id', audienciaId)
    .eq('estado', 'programada')

  if (data) revalidatePath(`/panel/expedientes/${data.expediente_id}`)
  revalidatePath('/panel/agenda')
  revalidatePath('/panel')
}

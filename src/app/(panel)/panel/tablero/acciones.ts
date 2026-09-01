'use server'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import { obtenerExpediente } from '@/lib/expedientes/datos'
import {
  anotacionDeCambios,
  cambiosDeEdicion,
  edicionDesde,
} from '@/lib/expedientes/edicion'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import { clienteServidor } from '@/lib/supabase/server'

/**
 * Mueve un expediente de etapa desde el tablero.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ POR QUÉ NO HAY ARRASTRAR Y SOLTAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Un tablero pide a gritos arrastrar tarjetas, y aquí no se puede. Mover la
 * etapa escribe en la bitácora, que es **inmutable**: un arrastre accidental
 * —el dedo en el trackpad, un clic que se corrió— deja asentado para siempre
 * que el asunto pasó a pruebas el día que no pasó, y eso no se borra, solo se
 * rectifica con otra actuación.
 *
 * Un selector y un botón cuestan un clic más y no se disparan solos. El tablero
 * es para VER la cartera; mover es un acto deliberado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA ANOTACIÓN ES LA MISMA QUE LA DEL EDITOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Se arma con `cambiosDeEdicion` + `anotacionDeCambios`, el mismo motor que usa
 * `/editar`. Si el rastro se escribiera aparte, dentro de un año la bitácora
 * tendría dos formas distintas de decir lo mismo según por dónde se movió el
 * asunto.
 */
export async function moverEtapa(formData: FormData): Promise<void> {
  const sesion = await exigirPanel()

  const expedienteId = formData.get('expedienteId')
  const etapa = formData.get('etapaActual')
  if (typeof expedienteId !== 'string' || typeof etapa !== 'string') return

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) return

  // La etapa tiene que ser del expediente y NO puede ser paralela: el asunto no
  // "está en" la suspensión, la tiene. Misma regla que en el editor.
  const destino = expediente.etapas.find((e) => e.clave === etapa)
  if (!destino || destino.paralela) return
  if (expediente.etapaActual === etapa) return

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
  const despues = { ...antes, etapaActual: etapa }

  const supabase = await clienteServidor()
  const { error } = await supabase
    .from('expedientes')
    .update({ etapa_actual: etapa })
    .eq('id', expedienteId)

  if (error) return

  const cambios = cambiosDeEdicion(antes, despues, {
    personas: {},
    etapas: Object.fromEntries(expediente.etapas.map((e) => [e.clave, e.nombre])),
  })
  const anotacion = anotacionDeCambios(cambios)

  if (anotacion) {
    await supabase.from('actuaciones').insert({
      expediente_id: expedienteId,
      tipo: 'nota_interna',
      fecha: hoyEnMexico(),
      titulo: anotacion.titulo,
      detalle: anotacion.detalle,
      etapa_clave: anotacion.etapaClave,
      visible_cliente: false,
      creado_por: sesion.usuarioId,
    })
  }

  revalidatePath('/panel/tablero')
  revalidatePath(`/panel/expedientes/${expedienteId}`)
}

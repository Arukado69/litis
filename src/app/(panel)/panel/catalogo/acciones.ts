'use server'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import { entradasDelRegimen, plazosVivosDeEntrada } from '@/lib/catalogo/datos'
import {
  avisoDePlazosAfectados,
  corrigeElComputo,
  leerVerificacion,
  validarVerificacion,
} from '@/lib/catalogo/verificacion'
import { clienteServidor } from '@/lib/supabase/server'
import type { RolMembresia } from '@/types/db'

import {
  ESTADO_INICIAL_VERIFICACION,
  type EstadoVerificacion,
} from './estado'

/**
 * Declarar que un plazo legal es correcto es **acto de quien puede firmar**.
 * Un asistente captura expedientes y agenda; no dictamina. Lo hace cumplir
 * también la política de RLS de la `0002`; aquí se repite para dar un mensaje
 * decente en vez de un error de base de datos.
 */
const PUEDE_VERIFICAR: readonly RolMembresia[] = ['titular', 'abogado']

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

function conError(
  entradaId: string,
  campos: Record<string, string>,
  error: string,
): EstadoVerificacion {
  return { ...ESTADO_INICIAL_VERIFICACION, entradaId, valores: campos, error }
}

/**
 * Verifica una entrada del catálogo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VERIFICAR ES ADOPTAR: SE COPIA AL DESPACHO
 * ─────────────────────────────────────────────────────────────────────────────
 * Las entradas de fábrica viven compartidas y ningún despacho puede escribirlas
 * — y está bien. Que el titular de un despacho revise el ordinario mercantil no
 * puede volver esa entrada "verificada" para otro despacho que nunca la vio, y
 * menos con el CNPCyF desplazando códigos locales a ritmos distintos por
 * entidad. La firma vale para quien la puso.
 *
 * Así que se inserta una copia propia con la firma, y a partir de ahí esa copia
 * sustituye a la compartida en todas las pantallas del despacho.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ UNA CORRECCIÓN NO RECALCULA LOS PLAZOS YA COMPUTADOS
 * ─────────────────────────────────────────────────────────────────────────────
 * Si el plazo era de 9 días y no de 15, cada plazo vivo computado con 15 tiene
 * una fecha equivocada. Cambiárselas solo, sin que nadie lo vea, es exactamente
 * lo que este producto no hace: el abogado ya agendó contra esa fecha, ya le
 * avisó al cliente y quizá ya está redactando. Se le enseñan cuáles son y él
 * decide uno por uno.
 */
export async function verificarEntrada(
  _previo: EstadoVerificacion,
  formData: FormData,
): Promise<EstadoVerificacion> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const entradaId = campos.entradaId ?? ''
  const regimen = campos.regimen ?? ''

  if (!PUEDE_VERIFICAR.includes(sesion.activa.rol)) {
    return conError(
      entradaId,
      campos,
      'Verificar un plazo es acto de quien puede firmar. Pídeselo al titular o a un abogado del despacho.',
    )
  }

  const entradas = await entradasDelRegimen(regimen)
  const original = entradas.find((e) => e.id === entradaId)
  if (!original) return conError(entradaId, campos, 'No se encontró esa entrada.')

  // La semilla de la que salió esta copia, si salió de alguna. Se necesita para
  // alcanzar los plazos que se computaron ANTES de adoptarla: esos siguen
  // apuntando al id compartido.
  const semilla =
    original.despachoId !== null && original.clave
      ? (entradas.find((e) => e.despachoId === null && e.clave === original.clave) ??
        null)
      : null

  const captura = leerVerificacion(campos)
  const problemasCaptura = validarVerificacion(captura)

  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return {
      ...ESTADO_INICIAL_VERIFICACION,
      entradaId,
      valores: campos,
      problemas,
    }
  }
  if (captura.dias === null) {
    return conError(entradaId, campos, 'Los días no son válidos.')
  }

  const supabase = await clienteServidor()
  const despachoId = sesion.activa.despachoId
  const firma = {
    dias: captura.dias,
    unidad: captura.unidad,
    fundamento: captura.fundamento,
    verificado_por: sesion.usuarioId,
    verificado_el: new Date().toISOString(),
    verificacion_notas: captura.notas,
  }

  const cambiaElComputo = corrigeElComputo(captura, original)

  // La compartida no se puede escribir: se adopta con una copia propia. La
  // propia sí se actualiza en el lugar, y la firma se vuelve a estampar —una
  // entrada corregida después de verificada necesita firma nueva, o el rastro
  // diría que se revisó algo que ya cambió.
  const { error } = original.despachoId
    ? await supabase
        .from('plazos_catalogo')
        .update(firma)
        .eq('id', original.id)
        .eq('despacho_id', despachoId)
    : await supabase.from('plazos_catalogo').insert({
        despacho_id: despachoId,
        clave: original.clave,
        regimen: original.regimen,
        etiqueta: original.etiqueta,
        nota: original.nota,
        ...firma,
      })

  if (error) {
    return conError(
      entradaId,
      campos,
      'No se pudo guardar la verificación. Vuelve a intentarlo.',
    )
  }

  revalidatePath('/panel/catalogo')

  // Solo si cambiaron los NÚMEROS hay plazos que revisar. Corregir únicamente
  // el fundamento arregla el rastro, no las fechas.
  const afectados = cambiaElComputo
    ? await plazosVivosDeEntrada(
        despachoId,
        [original.id, semilla?.id].filter((x): x is string => Boolean(x)),
      )
    : []

  return {
    entradaId,
    valores: {},
    error: null,
    problemas: {},
    guardado: cambiaElComputo
      ? 'Corregida y verificada.'
      : 'Verificada. A partir de ahora los cómputos con este plazo dejan de salir marcados como sin verificar.',
    aviso:
      afectados.length > 0
        ? avisoDePlazosAfectados(afectados.length, original, {
            dias: captura.dias,
            unidad: captura.unidad,
          })
        : null,
    afectados,
  }
}

/**
 * Retira la verificación del despacho.
 *
 * Borra la copia propia y deja que vuelva a mandar la compartida sin verificar.
 * Existe porque un ordenamiento se reforma: el día que cambie el texto contra
 * el que se revisó, lo honesto es que la entrada vuelva a salir marcada como no
 * verificada hasta que alguien la revise otra vez.
 */
export async function retirarVerificacion(formData: FormData): Promise<void> {
  const sesion = await exigirPanel()
  if (!PUEDE_VERIFICAR.includes(sesion.activa.rol)) return

  const entradaId = formData.get('entradaId')
  if (typeof entradaId !== 'string' || entradaId.length === 0) return

  const supabase = await clienteServidor()

  // ⚠️ Solo se borra una copia PROPIA que además tenga clave de semilla: sin el
  // filtro de clave, retirar la verificación de una entrada capturada a mano la
  // borraría del catálogo con todo y su contenido.
  await supabase
    .from('plazos_catalogo')
    .delete()
    .eq('id', entradaId)
    .eq('despacho_id', sesion.activa.despachoId)
    .not('clave', 'is', null)

  revalidatePath('/panel/catalogo')
}

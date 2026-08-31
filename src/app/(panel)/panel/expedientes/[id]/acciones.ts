'use server'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import {
  avisoExtemporaneidad,
  detalleActuacion,
  esExtemporanea,
  estadoResultante,
  leerCierre,
  tipoActuacionDeCierre,
  tituloActuacion,
  validarCierre,
} from '@/lib/plazos/cierre'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import { clienteServidor } from '@/lib/supabase/server'
import type { RolMembresia } from '@/types/db'

import {
  cierreConError,
  cierreConProblemas,
  type EstadoCierre,
} from './estado-plazo'

/**
 * Cancelar un plazo es una decisión sobre la vigilancia del asunto, no una
 * captura. Un pasante o un asistente registran hechos —"esto se presentó, aquí
 * está el acuse"—; decidir que un término **deja de vigilarse** cambia lo que
 * el despacho va a mirar mañana, y eso lo firma quien responde del expediente.
 *
 * ⚠️ Esta restricción vive en la capa 2 (la acción), no en la base. La RLS de
 * `plazos` deja escribir a todo el personal con acceso al expediente, así que
 * quien llame a la base por su cuenta con la sesión de un pasante puede
 * cancelar. No es un agujero de aislamiento —nadie sale de su despacho— sino
 * política interna sin respaldo en la base; cuando haya un despacho real que
 * la necesite en serio, se convierte en policy.
 */
const PUEDE_CANCELAR: readonly RolMembresia[] = ['titular', 'abogado']

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

/**
 * Cierra un plazo: se presentó la promoción, o dejó de aplicar.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMERO LA BITÁCORA, DESPUÉS EL ESTADO
 * ─────────────────────────────────────────────────────────────────────────────
 * La actuación se inserta antes de tocar el plazo. Si el segundo paso falla, lo
 * que queda es un plazo que sigue en el panel con su actuación ya asentada:
 * molesto, pero honesto —se ve, se vuelve a intentar y a lo sumo hay una
 * actuación repetida—. Al revés quedaría un plazo cerrado sin constancia de por
 * qué, que es justo el registro que no sirve para nada.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE MANDA ES LA FILA, NO EL FORMULARIO
 * ─────────────────────────────────────────────────────────────────────────────
 * El vencimiento, la notificación y el expediente se releen de la base. Si
 * vinieran del formulario, cambiar un campo oculto convertiría una presentación
 * extemporánea en una presentación en tiempo — y con eso se cae toda la razón
 * de ser de esta pantalla.
 */
export async function cerrarPlazo(
  _previo: EstadoCierre,
  formData: FormData,
): Promise<EstadoCierre> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const plazoId = campos.plazoId ?? ''

  const supabase = await clienteServidor()

  // La RLS decide si esta fila es visible; si no lo es, no llega nada.
  const { data: plazo } = await supabase
    .from('plazos')
    .select(
      'id, expediente_id, etiqueta, estado, fecha_notificacion, fecha_vencimiento_efectiva',
    )
    .eq('id', plazoId)
    .maybeSingle()

  if (!plazo) {
    return cierreConError(campos, 'No se encontró el plazo.')
  }

  if (plazo.estado !== 'pendiente') {
    // Sin este freno, dos pestañas abiertas dejan dos actuaciones de cierre
    // sobre el mismo plazo, y la bitácora no se puede corregir después.
    return cierreConError(
      campos,
      'Este plazo ya se había cerrado. Recarga la pantalla para ver cómo quedó.',
    )
  }

  const captura = leerCierre(campos)

  if (captura.accion === 'cancelada' && !PUEDE_CANCELAR.includes(sesion.activa.rol)) {
    return cierreConError(
      campos,
      'Cancelar un plazo lo hace el titular o el abogado responsable. Si ya no aplica, pídeselo con el motivo.',
    )
  }

  const contexto = {
    hoy: hoyEnMexico(),
    fechaVencimiento: plazo.fecha_vencimiento_efectiva,
    fechaNotificacion: plazo.fecha_notificacion,
  }

  const problemasCaptura = validarCierre(captura, contexto)

  const extemporanea =
    captura.accion === 'presentada' &&
    captura.fechaPresentacion !== null &&
    esExtemporanea(captura.fechaPresentacion, contexto.fechaVencimiento)

  const aviso =
    extemporanea && captura.fechaPresentacion
      ? avisoExtemporaneidad(captura.fechaPresentacion, contexto.fechaVencimiento)
      : null

  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return cierreConProblemas(campos, problemas, aviso)
  }

  const { data: actuacion, error: errorActuacion } = await supabase
    .from('actuaciones')
    .insert({
      expediente_id: plazo.expediente_id,
      tipo: tipoActuacionDeCierre(captura),
      // Cuándo OCURRIÓ. En la cancelación no hay hecho externo que fechar, así
      // que se fecha el día en que se tomó la decisión.
      fecha: captura.fechaPresentacion ?? contexto.hoy,
      titulo: tituloActuacion(captura, plazo.etiqueta, extemporanea),
      detalle: detalleActuacion(captura, contexto.fechaVencimiento, extemporanea),
      visible_cliente: false,
      creado_por: sesion.usuarioId,
    })
    .select('id')
    .single()

  if (errorActuacion || !actuacion) {
    return cierreConError(
      campos,
      'No se pudo asentar la actuación en la bitácora, así que el plazo sigue abierto. Vuelve a intentarlo.',
    )
  }

  const { error } = await supabase
    .from('plazos')
    .update({
      estado: estadoResultante(captura),
      atendido_el: new Date().toISOString(),
      atendido_por: sesion.usuarioId,
      actuacion_cumplimiento_id: actuacion.id,
    })
    .eq('id', plazo.id)
    // Que no cierre dos veces si dos pestañas envían a la vez.
    .eq('estado', 'pendiente')

  if (error) {
    return cierreConError(
      campos,
      'La actuación quedó asentada, pero el plazo NO se cerró y sigue en el panel. Vuelve a intentarlo.',
    )
  }

  revalidatePath(`/panel/expedientes/${plazo.expediente_id}`)
  revalidatePath('/panel')

  return { valores: {}, error: null, problemas: {}, aviso: null }
}

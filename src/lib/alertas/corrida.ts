import 'server-only'

import { enviarConPlantilla } from '@/lib/email/envio'
import { avisarAlOperador } from '@/lib/email/operador'
import {
  calcularAlertas,
  claveAlerta,
  type AlertaPendiente,
  type NivelAlerta,
  type PlazoVigilado,
} from '@/lib/plazos/alertas'
import { cargarTodosLosCalendarios } from '@/lib/plazos/carga'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import { envSitioUrl } from '@/lib/supabase/env'
import { clienteServicio } from '@/lib/supabase/service'

import { repartir, type Destinatario, type Lote } from './destinatarios'
import { asunto, cuerpo, renglon } from './redaccion'

/**
 * La corrida diaria de alertas de vencimiento.
 *
 * Es la promesa central del producto: hasta aquí, el sistema solo avisaba si
 * alguien abría el panel. Esto avisa aunque nadie lo abra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ SI NO SE PUEDE LEER EL REGISTRO DE ENVÍOS, LA CORRIDA SE DETIENE
 * ─────────────────────────────────────────────────────────────────────────────
 * `plazo_alertas_enviadas` es lo único que impide repetir un aviso. Si esa
 * lectura falla y la corrida sigue con el registro vacío, TODOS los plazos en
 * ventana reciben otra vez su aviso — y otra vez mañana, y pasado. En una
 * semana el correo del despacho está en spam y el aviso que sí importaba se
 * pierde con los demás.
 *
 * Así que se detiene, avisa al operador y no manda nada. **Es preferible no
 * avisar hoy que quemar el correo de la firma.** (Es la misma lección que costó
 * caro en el proyecto anterior.)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SE MANDA PRIMERO Y SE REGISTRA DESPUÉS
 * ─────────────────────────────────────────────────────────────────────────────
 * Si se registrara antes y el envío fallara, el aviso quedaría marcado como
 * dado sin haber salido nunca, y ese término se queda sin avisar para siempre.
 * Al revés, lo peor que pasa es un correo repetido mañana.
 *
 * Entre un término perdido y un correo duplicado no hay comparación.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ UN ENVÍO SIMULADO NO SE REGISTRA
 * ─────────────────────────────────────────────────────────────────────────────
 * Sin `RESEND_API_KEY` el correo no sale: se escribe en consola. Si eso contara
 * como enviado y quedara anotado, un despliegue con la llave mal puesta
 * marcaría todos los avisos como dados **sin que saliera uno solo**, y ninguno
 * se volvería a intentar jamás. El sistema entero diría que avisó, en verde, el
 * día que se pierda un término.
 *
 * Así que lo simulado no se anota y la corrida lo reporta con todas sus letras
 * (`modoSimulacion`). En desarrollo eso hace que cada corrida repita todo, que
 * es exactamente lo que debe pasar: nada se dio por avisado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CORRE CON CLAVE DE SERVICIO
 * ─────────────────────────────────────────────────────────────────────────────
 * No hay sesión: es un cron. Es uno de los dos usos legítimos de esa clave, y
 * por eso el endpoint que la invoca exige `CRON_SECRET` antes de llegar aquí.
 */

/** Tope por consulta. Un despacho chico no se acerca; evita traer de más. */
const TOPE = 5000

export interface ResumenCorrida {
  ok: boolean
  hoy: string
  /** Plazos vigilados que entraron al cálculo. */
  revisados: number
  alertas: number
  correosEnviados: number
  correosFallidos: number
  /** Se escribieron en consola porque no hay proveedor de correo. No se anotan. */
  correosSimulados: number
  /**
   * No hay `RESEND_API_KEY`: NADA salió de verdad. Se reporta arriba para que
   * un 200 con esta bandera no se confunda con una corrida que sí avisó.
   */
  modoSimulacion: boolean
  /** Alertas sin nadie a quien avisarle: ni responsable ni titular con correo. */
  sinDestinatario: number
  /** Niveles que salieron, para poder leer la corrida de un vistazo. */
  porNivel: Partial<Record<NivelAlerta, number>>
  motivo?: string
}

/**
 * ⚠️ Aquí NO se usan joins de PostgREST.
 *
 * El cliente de servicio no infiere las relaciones desde los tipos escritos a
 * mano (`Relationships: []` en `src/types/db.ts`), así que un join solo
 * compilaría con un cast — y un cast ahí escondería el error de verdad el día
 * que el esquema cambie. Tres consultas en un proceso que corre una vez al día
 * no cuestan nada; un tipo que miente sí.
 */

export async function correrAlertas(
  hoy = hoyEnMexico(),
): Promise<ResumenCorrida> {
  const vacio: ResumenCorrida = {
    ok: false,
    hoy,
    revisados: 0,
    alertas: 0,
    correosEnviados: 0,
    correosFallidos: 0,
    correosSimulados: 0,
    modoSimulacion: !process.env.RESEND_API_KEY?.trim(),
    sinDestinatario: 0,
    porNivel: {},
  }

  const supabase = clienteServicio()

  // ── 1. Los plazos vivos ───────────────────────────────────────────────────
  const { data: filas, error: errorPlazos } = await supabase
    .from('plazos')
    .select(
      'id, expediente_id, etiqueta, calendario_id, fecha_vencimiento_efectiva, responsable_id',
    )
    .eq('estado', 'pendiente')
    .order('fecha_vencimiento_efectiva')
    .limit(TOPE)

  if (errorPlazos) {
    await avisarAlOperador(
      'alertas',
      'La corrida de alertas no pudo leer los plazos',
      `No salió ningún aviso. ${errorPlazos.message}`,
    )
    return { ...vacio, motivo: 'No se pudieron leer los plazos.' }
  }

  const plazos = filas ?? []
  if (plazos.length === 0) {
    return { ...vacio, ok: true }
  }

  // ── 2. El registro de lo ya enviado ───────────────────────────────────────
  // ⚠️ Si esto falla, la corrida SE DETIENE. Ver el encabezado.
  const { data: enviados, error: errorRegistro } = await supabase
    .from('plazo_alertas_enviadas')
    .select('plazo_id, nivel')
    .in(
      'plazo_id',
      plazos.map((p) => p.id),
    )

  if (errorRegistro) {
    await avisarAlOperador(
      'alertas',
      'La corrida de alertas se detuvo',
      `No se pudo leer el registro de avisos ya enviados (${errorRegistro.message}), así que no se mandó ninguno. Seguir sin ese registro le reenviaría el mismo aviso a todos, todos los días, hasta quemar el correo del despacho.`,
    )
    return {
      ...vacio,
      motivo: 'No se pudo leer el registro de envíos. No se mandó nada.',
    }
  }

  const yaEnviados = new Set(
    (enviados ?? []).map((e) => claveAlerta(e.plazo_id, e.nivel)),
  )

  // ── 3. Calendarios ────────────────────────────────────────────────────────
  const { calendarios, porOmision } = await cargarTodosLosCalendarios()
  if (!porOmision) {
    await avisarAlOperador(
      'alertas',
      'La corrida de alertas no encontró calendarios',
      'Sin calendario de días inhábiles no se pueden contar días hábiles, y contar en naturales avisaría tarde justo en los puentes. No salió ningún aviso.',
    )
    return { ...vacio, motivo: 'No hay calendarios cargados.' }
  }

  // ── 4. Expedientes y responsables ─────────────────────────────────────────
  const { data: expedientes } = await supabase
    .from('expedientes')
    .select('id, despacho_id, numero_interno, numero_organo, caratula, estado')
    .in(
      'id',
      plazos.map((p) => p.expediente_id),
    )

  const porExpediente = new Map((expedientes ?? []).map((e) => [e.id, e]))

  const responsables = [
    ...new Set(plazos.map((p) => p.responsable_id).filter((id): id is string => !!id)),
  ]
  const { data: perfiles } = responsables.length
    ? await supabase.from('perfiles').select('id, nombre, correo').in('id', responsables)
    : { data: [] }

  const porPerfil = new Map((perfiles ?? []).map((p) => [p.id, p]))

  // ── 5. Agrupar por despacho ───────────────────────────────────────────────
  const porDespacho = new Map<string, PlazoVigilado[]>()

  for (const fila of plazos) {
    const exp = porExpediente.get(fila.expediente_id)
    if (!exp) continue
    // Un aviso de un asunto ya cerrado es ruido, y el ruido enseña a ignorar
    // los avisos. R2-bis ya impide concluir con plazos vivos; esto cubre los
    // que quedaran de antes.
    if (exp.estado === 'concluido' || exp.estado === 'archivado') continue

    const perfil = fila.responsable_id
      ? (porPerfil.get(fila.responsable_id) ?? null)
      : null
    const lista = porDespacho.get(exp.despacho_id) ?? []
    lista.push({
      plazoId: fila.id,
      expedienteId: fila.expediente_id,
      calendarioId: fila.calendario_id,
      numeroExpediente: exp.numero_organo ?? exp.numero_interno,
      caratula: exp.caratula,
      etiqueta: fila.etiqueta,
      fechaVencimiento: fila.fecha_vencimiento_efectiva,
      responsableId: fila.responsable_id,
      responsableNombre: perfil?.nombre ?? null,
      responsableEmail: perfil?.correo ?? null,
      atendido: false,
    })
    porDespacho.set(exp.despacho_id, lista)
  }

  const titulares = await titularesPorDespacho(supabase, [...porDespacho.keys()])

  // ── 6. Calcular, repartir y mandar ────────────────────────────────────────
  const resumen: ResumenCorrida = { ...vacio, ok: true }

  for (const [despachoId, vigilados] of porDespacho) {
    resumen.revisados += vigilados.length

    const alertas = calcularAlertas({
      plazos: vigilados,
      yaEnviados,
      hoy,
      calendarios,
      calendarioPorOmision: porOmision,
    })
    if (alertas.length === 0) continue

    resumen.alertas += alertas.length
    for (const a of alertas) {
      resumen.porNivel[a.nivel] = (resumen.porNivel[a.nivel] ?? 0) + 1
    }

    const { lotes, sinDestinatario } = repartir({
      alertas,
      titular: titulares.get(despachoId) ?? null,
    })

    if (sinDestinatario.length > 0) {
      resumen.sinDestinatario += sinDestinatario.length
      await avisarAlOperador(
        'alertas',
        'Hay términos de los que no se le pudo avisar a nadie',
        `El despacho ${despachoId} tiene ${sinDestinatario.length} plazo(s) sin responsable y sin titular con correo:\n\n${sinDestinatario.map(renglon).join('\n')}`,
      )
    }

    for (const lote of lotes) {
      const salida = await mandarLote(lote)

      if (salida === 'enviado') {
        resumen.correosEnviados += 1
        // Se registra DESPUÉS de mandar. Ver el encabezado.
        await registrar(supabase, lote)
      } else if (salida === 'simulado') {
        // No se registra: ver el encabezado. Un aviso que no salió no está dado.
        resumen.correosSimulados += 1
      } else {
        resumen.correosFallidos += 1
      }
    }
  }

  if (resumen.modoSimulacion && resumen.alertas > 0) {
    console.warn(
      `[alertas] MODO SIMULACIÓN: ${resumen.alertas} aviso(s) NO salieron y no quedaron registrados. Configura RESEND_API_KEY.`,
    )
  }

  return resumen
}

async function mandarLote(
  lote: Lote,
): Promise<'enviado' | 'simulado' | 'falló'> {
  const armado = cuerpo(lote, envSitioUrl())
  const envio = await enviarConPlantilla(lote.destinatario.correo, {
    titulo: asunto(lote),
    parrafos: armado.parrafos,
    boton: armado.boton,
    pie: armado.pie,
  })

  if (envio.estado === 'falló') {
    console.error(
      `[alertas] no salió el aviso para ${lote.destinatario.correo}: ${envio.motivo}`,
    )
    return 'falló'
  }
  return envio.estado
}

async function registrar(
  supabase: ReturnType<typeof clienteServicio>,
  lote: Lote,
): Promise<void> {
  const filas = lote.alertas.map((a: AlertaPendiente) => ({
    plazo_id: a.plazo.plazoId,
    nivel: a.nivel,
    destinatarios: [lote.destinatario.correo],
  }))

  // `onConflict` con el índice único (plazo_id, nivel): si dos corridas se
  // traslapan, la segunda no revienta ni duplica.
  const { error } = await supabase
    .from('plazo_alertas_enviadas')
    .upsert(filas, { onConflict: 'plazo_id,nivel', ignoreDuplicates: true })

  if (error) {
    await avisarAlOperador(
      'alertas',
      'Un aviso salió pero no se pudo registrar',
      `El correo a ${lote.destinatario.correo} sí se mandó, pero no quedó anotado en el registro (${error.message}), así que mañana se va a repetir. Revisa los permisos de plazo_alertas_enviadas.`,
    )
  }
}

async function titularesPorDespacho(
  supabase: ReturnType<typeof clienteServicio>,
  despachos: readonly string[],
): Promise<Map<string, Destinatario>> {
  const mapa = new Map<string, Destinatario>()
  if (despachos.length === 0) return mapa

  // Dos consultas en vez de un join: el cliente de servicio no infiere la
  // relación con `perfiles` desde los tipos escritos a mano, y forzarla con un
  // cast escondería un error de verdad el día que el esquema cambie.
  const { data: membresias } = await supabase
    .from('membresias')
    .select('despacho_id, perfil_id')
    .in('despacho_id', [...despachos])
    .eq('rol', 'titular')
    .eq('estado', 'activa')

  if (!membresias || membresias.length === 0) return mapa

  const { data: perfiles } = await supabase
    .from('perfiles')
    .select('id, nombre, correo')
    .in(
      'id',
      membresias.map((m) => m.perfil_id),
    )

  const porPerfil = new Map((perfiles ?? []).map((p) => [p.id, p]))

  for (const m of membresias) {
    const perfil = porPerfil.get(m.perfil_id)
    if (!perfil?.correo) continue
    mapa.set(m.despacho_id, {
      perfilId: m.perfil_id,
      nombre: perfil.nombre || perfil.correo,
      correo: perfil.correo,
    })
  }
  return mapa
}

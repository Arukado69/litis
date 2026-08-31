/**
 * Edición del expediente (motor puro, sin efectos).
 *
 * El alta escribe una vez; después, un asunto **cambia todo el tiempo**: se
 * admite la demanda y el juzgado asigna su número, el titular reasigna al
 * responsable, el asunto pasa de emplazamiento a pruebas, se concluye.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ SE PUEDE CAMBIAR Y QUÉ NO
 * ─────────────────────────────────────────────────────────────────────────────
 * La **materia**, la **vía** y el **fuero** no se editan aquí, a propósito. De
 * la vía sale el régimen de cómputo, y del régimen salen las fechas de todos
 * los plazos ya calculados. Cambiarla en caliente dejaría plazos computados con
 * un régimen y un expediente que dice otro, sin que nada avise. Si de verdad se
 * capturó mal la vía, se cierra ese expediente y se abre el correcto: es más
 * trabajo, y es lo honesto.
 *
 * El **número interno** tampoco: es como el despacho llama al asunto de viva
 * voz y aparece en escritos ya presentados.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CADA CAMBIO QUE IMPORTA DEJA RASTRO
 * ─────────────────────────────────────────────────────────────────────────────
 * Cambiar de responsable, mover la etapa o concluir el asunto son hechos del
 * expediente, no ajustes de pantalla. Van a la bitácora —que es inmutable— con
 * el antes y el después. Lo que no cambia la historia del asunto (una nota, la
 * cuantía que faltaba capturar) se guarda sin anotar nada: una bitácora que
 * registra cada tecleo es una bitácora que nadie lee.
 */

import type { EstadoExpediente, ResultadoExpediente } from '@/types/db'

import { leerCuantia, leerFecha, type Problema } from './captura'

export type { Problema }

export const ESTADO_EXPEDIENTE_ETIQUETA: Record<EstadoExpediente, string> = {
  prospecto: 'Prospecto',
  activo: 'Activo',
  suspendido: 'Suspendido',
  concluido: 'Concluido',
  archivado: 'Archivado',
}

export const RESULTADO_ETIQUETA: Record<ResultadoExpediente, string> = {
  favorable: 'Favorable',
  parcialmente_favorable: 'Parcialmente favorable',
  desfavorable: 'Desfavorable',
  convenio: 'Convenio',
  desistimiento: 'Desistimiento',
  caducidad: 'Caducidad',
  sobreseimiento: 'Sobreseimiento',
  otro: 'Otro',
}

const ESTADOS = Object.keys(ESTADO_EXPEDIENTE_ETIQUETA) as EstadoExpediente[]
const RESULTADOS = Object.keys(RESULTADO_ETIQUETA) as ResultadoExpediente[]

/** Estados en los que el asunto ya terminó y admite resultado. */
const TERMINADOS: readonly EstadoExpediente[] = ['concluido', 'archivado']

export interface CapturaEdicion {
  numeroOrgano: string | null
  instancia: string | null
  entidad: string | null
  cuantia: number | null
  responsableId: string | null
  restringido: boolean
  notas: string | null
  estado: EstadoExpediente
  resultado: ResultadoExpediente | null
  fechaConclusion: string | null
  etapaActual: string | null
}

export interface EtapaDisponible {
  clave: string
  nombre: string
  paralela: boolean
}

export interface ContextoEdicion {
  hoy: string
  etapas: readonly EtapaDisponible[]
  /** Cuántos plazos siguen corriendo en este expediente. */
  plazosPendientes: number
}

function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

export function leerEdicion(campos: Record<string, string>): CapturaEdicion {
  const estado = campos.estado as EstadoExpediente
  const resultado = campos.resultado as ResultadoExpediente

  return {
    numeroOrgano: texto(campos, 'numeroOrgano'),
    instancia: texto(campos, 'instancia'),
    entidad: texto(campos, 'entidad'),
    cuantia: leerCuantia(campos.cuantia),
    responsableId: texto(campos, 'responsableId'),
    restringido: campos.restringido === 'on' || campos.restringido === 'true',
    notas: texto(campos, 'notas'),
    estado: ESTADOS.includes(estado) ? estado : 'activo',
    resultado: RESULTADOS.includes(resultado) ? resultado : null,
    fechaConclusion: leerFecha(campos.fechaConclusion),
    etapaActual: texto(campos, 'etapaActual'),
  }
}

export function validarEdicion(
  captura: CapturaEdicion,
  contexto: ContextoEdicion,
): Problema[] {
  const problemas: Problema[] = []

  if (captura.etapaActual) {
    const etapa = contexto.etapas.find((e) => e.clave === captura.etapaActual)
    if (!etapa) {
      problemas.push({
        campo: 'etapaActual',
        mensaje: 'Esa etapa no pertenece a este expediente.',
      })
    } else if (etapa.paralela) {
      // Una etapa paralela no es una posición del avance: el asunto no "está
      // en" la suspensión ni en el incidente, los TIENE mientras sigue en su
      // etapa. Ponerla como actual rompería el porcentaje de avance y, peor,
      // haría creer que el juicio se detuvo donde no se detuvo.
      problemas.push({
        campo: 'etapaActual',
        mensaje: `"${etapa.nombre}" corre en paralelo al juicio, no es una etapa del avance. El asunto sigue en la que traía.`,
      })
    }
  }

  const terminado = TERMINADOS.includes(captura.estado)

  if (captura.estado === 'concluido' && !captura.resultado) {
    // Un asunto concluido sin resultado es el dato que nadie vuelve a
    // capturar, y es justo el que se necesita para saber cómo le va al
    // despacho.
    problemas.push({
      campo: 'resultado',
      mensaje: 'Un asunto que se concluye lleva resultado. Es el dato que después nadie vuelve a capturar.',
    })
  }

  if (captura.resultado && !terminado) {
    problemas.push({
      campo: 'resultado',
      mensaje: 'El resultado se captura al concluir o archivar el asunto.',
    })
  }

  if (terminado && contexto.plazosPendientes > 0) {
    // Sin este freno, los plazos de un asunto cerrado siguen apareciendo en el
    // panel para siempre: el asunto ya no existe para nadie y sus términos
    // siguen pidiendo atención. Cerrar el expediente no debe cerrar plazos en
    // silencio — cada uno tiene que decir si se presentó o si dejó de aplicar.
    const n = contexto.plazosPendientes
    problemas.push({
      campo: 'estado',
      mensaje: `Este asunto todavía tiene ${n} plazo${n === 1 ? '' : 's'} corriendo. Ciérra${n === 1 ? 'lo' : 'los'} primero: si no, seguirá${n === 1 ? '' : 'n'} pidiendo atención en el panel de un expediente que ya está cerrado.`,
    })
  }

  if (captura.fechaConclusion && captura.fechaConclusion > contexto.hoy) {
    problemas.push({
      campo: 'fechaConclusion',
      mensaje: 'La conclusión no puede tener fecha futura.',
    })
  }

  return problemas
}

/**
 * Deja la captura coherente antes de escribirla.
 *
 * Concluir sin poner la fecha es lo que hace cualquiera: se pone la de hoy en
 * vez de dejar el campo vacío. Y volver a abrir un asunto tiene que **borrar**
 * el resultado y la conclusión: un expediente activo con resultado
 * "desfavorable" pegado es un dato que contradice al otro.
 */
export function normalizarEdicion(
  captura: CapturaEdicion,
  hoy: string,
): CapturaEdicion {
  if (!TERMINADOS.includes(captura.estado)) {
    return { ...captura, resultado: null, fechaConclusion: null }
  }
  return {
    ...captura,
    fechaConclusion: captura.fechaConclusion ?? hoy,
  }
}

// ── Rastro en la bitácora ───────────────────────────────────────────────────

export interface Cambio {
  campo: keyof CapturaEdicion
  etiqueta: string
  /** Legibles: ya traducidos a nombres, etiquetas y pesos. */
  antes: string
  despues: string
  /**
   * El valor crudo del después. La bitácora se escribe con el legible, pero
   * `actuaciones.etapa_clave` necesita la CLAVE — guardar ahí "Ofrecimiento de
   * pruebas" en vez de `pruebas` deja un rastro que no liga con nada.
   */
  valorDespues: CapturaEdicion[keyof CapturaEdicion]
  /** Los mayores van a la bitácora; los menores se guardan y ya. */
  mayor: boolean
}

/** Cómo se llama cada campo cuando se escribe en la bitácora. */
const CAMPOS: {
  campo: keyof CapturaEdicion
  etiqueta: string
  mayor: boolean
}[] = [
  { campo: 'numeroOrgano', etiqueta: 'Número del órgano', mayor: true },
  { campo: 'responsableId', etiqueta: 'Responsable', mayor: true },
  { campo: 'etapaActual', etiqueta: 'Etapa', mayor: true },
  { campo: 'estado', etiqueta: 'Estado', mayor: true },
  { campo: 'resultado', etiqueta: 'Resultado', mayor: true },
  { campo: 'restringido', etiqueta: 'Acceso restringido', mayor: true },
  { campo: 'fechaConclusion', etiqueta: 'Fecha de conclusión', mayor: true },
  { campo: 'instancia', etiqueta: 'Instancia', mayor: false },
  { campo: 'entidad', etiqueta: 'Entidad', mayor: false },
  { campo: 'cuantia', etiqueta: 'Cuantía', mayor: false },
  { campo: 'notas', etiqueta: 'Notas', mayor: false },
]

/** Nombres para los ids: sin esto la bitácora diría "de un uuid a otro uuid". */
export interface Diccionario {
  personas: Readonly<Record<string, string>>
  etapas: Readonly<Record<string, string>>
}

const DICCIONARIO_VACIO: Diccionario = { personas: {}, etapas: {} }

function comoTexto(
  campo: keyof CapturaEdicion,
  valor: unknown,
  dic: Diccionario,
): string {
  if (valor === null || valor === undefined || valor === '') return '(vacío)'
  if (typeof valor === 'boolean') return valor ? 'sí' : 'no'
  if (campo === 'responsableId') return dic.personas[String(valor)] ?? 'otra persona'
  if (campo === 'etapaActual') return dic.etapas[String(valor)] ?? String(valor)
  if (campo === 'estado') return ESTADO_EXPEDIENTE_ETIQUETA[valor as EstadoExpediente]
  if (campo === 'resultado') return RESULTADO_ETIQUETA[valor as ResultadoExpediente]
  if (campo === 'cuantia' && typeof valor === 'number') {
    return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
  }
  return String(valor)
}

export function cambiosDeEdicion(
  antes: CapturaEdicion,
  despues: CapturaEdicion,
  diccionario: Diccionario = DICCIONARIO_VACIO,
): Cambio[] {
  const cambios: Cambio[] = []

  for (const { campo, etiqueta, mayor } of CAMPOS) {
    if (antes[campo] === despues[campo]) continue
    cambios.push({
      campo,
      etiqueta,
      antes: comoTexto(campo, antes[campo], diccionario),
      despues: comoTexto(campo, despues[campo], diccionario),
      valorDespues: despues[campo],
      mayor,
    })
  }

  return cambios
}

export interface AnotacionBitacora {
  titulo: string
  detalle: string
  /** Solo cuando la edición movió la etapa. */
  etapaClave: string | null
}

/**
 * La anotación que se asienta, o `null` si nada de lo que cambió merece una.
 *
 * Se escribe UNA por edición, no una por campo: quien lea la bitácora dentro
 * de dos años quiere ver "el 3 de septiembre pasó esto", no once renglones del
 * mismo minuto.
 */
export function anotacionDeCambios(
  cambios: readonly Cambio[],
): AnotacionBitacora | null {
  const mayores = cambios.filter((c) => c.mayor)
  if (mayores.length === 0) return null

  const etapa = mayores.find((c) => c.campo === 'etapaActual')

  return {
    titulo:
      mayores.length === 1 && mayores[0]
        ? `${mayores[0].etiqueta}: ${mayores[0].antes} → ${mayores[0].despues}`
        : `Actualización del expediente (${mayores.length} cambios)`,
    detalle: mayores
      .map((c) => `${c.etiqueta}: ${c.antes} → ${c.despues}`)
      .join('\n'),
    etapaClave: typeof etapa?.valorDespues === 'string' ? etapa.valorDespues : null,
  }
}

/**
 * Los datos actuales del expediente, en la forma que come el editor.
 *
 * Existe para que el "antes" del comparativo salga de la misma estructura que
 * el "después". Comparar dos formas distintas es como se cuelan los cambios
 * fantasma —`null` contra `''`— que llenan la bitácora de ruido.
 */
export function edicionDesde(fila: {
  numeroOrgano: string | null
  instancia: string | null
  entidad: string | null
  cuantia: number | null
  responsableId: string | null
  restringido: boolean
  notas: string | null
  estado: EstadoExpediente
  resultado: ResultadoExpediente | null
  fechaConclusion: string | null
  etapaActual: string | null
}): CapturaEdicion {
  return { ...fila }
}

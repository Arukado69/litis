/**
 * Verificación del catálogo de plazos (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VERIFICAR ES ADOPTAR, NO BENDECIR LO DE FÁBRICA
 * ─────────────────────────────────────────────────────────────────────────────
 * Las entradas semilla viven con `despacho_id IS NULL`: son compartidas y NADIE
 * puede escribirlas (lo impide la política de la `0002`). Eso no es un estorbo,
 * es la semántica correcta.
 *
 * Verificar un plazo es un **acto profesional**: alguien con cédula declara que
 * ese término, en esa vía, es de esos días y con ese fundamento. Esa firma vale
 * para quien la puso. Que el titular de un despacho en Monterrey revise el
 * ordinario mercantil no puede convertir esa entrada en "verificada" para un
 * despacho en Mérida que nunca la vio — y menos cuando el CNPCyF está
 * desplazando códigos locales a ritmos distintos por entidad.
 *
 * Así que verificar **copia** la entrada al despacho con su firma. La semilla
 * compartida queda intacta y sigue sin verificar para todos los demás.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA COPIA DEL DESPACHO GANA
 * ─────────────────────────────────────────────────────────────────────────────
 * Una vez adoptada, la entrada propia sustituye a la compartida en todas las
 * pantallas. Sin esa regla, el selector de plazos mostraría el mismo término
 * dos veces —uno verificado y otro no— y quien capture va a elegir cualquiera.
 */

import type { UnidadPlazo } from '@/lib/plazos/regimenes'

export interface Problema {
  campo: string
  mensaje: string
}

/** Una entrada tal como sale de la base, con su procedencia. */
export interface EntradaDelCatalogo {
  id: string
  /** `null` = compartida (de fábrica). Con valor = propia del despacho. */
  despachoId: string | null
  /** Llave estable de la semilla. `null` en las capturadas a mano. */
  clave: string | null
  regimen: string
  etiqueta: string
  dias: number
  unidad: string
  fundamento: string
  nota: string | null
  verificadoPor: string | null
  verificadoEl: string | null
  verificacionNotas: string | null
}

export type EstadoEntrada =
  /** De fábrica, sin que nadie del despacho la haya revisado. */
  | 'semilla'
  /** El despacho la adoptó tal cual venía. */
  | 'verificada'
  /** El despacho la adoptó cambiando días, unidad o fundamento. */
  | 'corregida'
  /** Capturada por el despacho, sin origen en la semilla. */
  | 'propia'

export const ESTADO_ETIQUETA: Record<EstadoEntrada, string> = {
  semilla: 'Sin verificar',
  verificada: 'Verificada',
  corregida: 'Corregida y verificada',
  propia: 'Del despacho',
}

/**
 * En qué estado está una entrada.
 *
 * Necesita la semilla original para poder decir si el despacho la corrigió o
 * solo la confirmó — y esa diferencia importa: "la revisé y estaba bien" no es
 * lo mismo que "la revisé y decía 15 donde son 9".
 */
export function estadoDeEntrada(
  entrada: EntradaDelCatalogo,
  semilla: EntradaDelCatalogo | null,
): EstadoEntrada {
  if (entrada.despachoId === null) return 'semilla'
  if (entrada.clave === null) return 'propia'
  if (!semilla) return 'propia'

  const cambio =
    entrada.dias !== semilla.dias ||
    entrada.unidad !== semilla.unidad ||
    entrada.fundamento.trim() !== semilla.fundamento.trim()

  return cambio ? 'corregida' : 'verificada'
}

export interface EntradaResuelta {
  entrada: EntradaDelCatalogo
  estado: EstadoEntrada
  /** La de fábrica que esta reemplaza, si reemplaza alguna. */
  semilla: EntradaDelCatalogo | null
}

/**
 * Funde el catálogo compartido con el del despacho.
 *
 * La entrada propia gana sobre la compartida de la misma clave. Sin esto, el
 * selector de plazos enseñaría el mismo término dos veces y quien capture
 * elegiría cualquiera de los dos — que es peor que no haber verificado.
 */
export function resolverCatalogo(
  entradas: readonly EntradaDelCatalogo[],
): EntradaResuelta[] {
  const semillas = new Map<string, EntradaDelCatalogo>()
  for (const e of entradas) {
    if (e.despachoId === null && e.clave) semillas.set(e.clave, e)
  }

  const propiasPorClave = new Map<string, EntradaDelCatalogo>()
  for (const e of entradas) {
    if (e.despachoId !== null && e.clave) propiasPorClave.set(e.clave, e)
  }

  const salida: EntradaResuelta[] = []

  for (const e of entradas) {
    // La compartida se cae si el despacho ya tiene la suya.
    if (e.despachoId === null && e.clave && propiasPorClave.has(e.clave)) continue

    const semilla = e.clave ? (semillas.get(e.clave) ?? null) : null
    salida.push({
      entrada: e,
      estado: estadoDeEntrada(e, e.despachoId === null ? null : semilla),
      // La propia guarda de qué semilla salió, para poder enseñar el antes.
      semilla: e.despachoId === null ? null : semilla,
    })
  }

  return salida.sort((a, b) => a.entrada.etiqueta.localeCompare(b.entrada.etiqueta, 'es'))
}

/** Cuántas de cada estado. Para el encabezado de la pantalla. */
export function resumenDelCatalogo(
  resueltas: readonly EntradaResuelta[],
): Record<EstadoEntrada, number> {
  const cuenta: Record<EstadoEntrada, number> = {
    semilla: 0,
    verificada: 0,
    corregida: 0,
    propia: 0,
  }
  for (const r of resueltas) cuenta[r.estado] += 1
  return cuenta
}

// ── La captura de la verificación ───────────────────────────────────────────

export interface CapturaVerificacion {
  dias: number | null
  unidad: UnidadPlazo
  fundamento: string
  notas: string
}

export function leerVerificacion(
  campos: Record<string, string>,
): CapturaVerificacion {
  const dias = Number(campos.dias?.trim())
  return {
    dias: Number.isInteger(dias) && dias >= 1 ? dias : null,
    unidad: campos.unidad === 'naturales' ? 'naturales' : 'habiles',
    fundamento: campos.fundamento?.trim() ?? '',
    notas: campos.notas?.trim() ?? '',
  }
}

/** Mínimo de una nota de verificación que signifique algo. */
const LARGO_MIN_NOTAS = 10

export function validarVerificacion(
  captura: CapturaVerificacion,
): Problema[] {
  const problemas: Problema[] = []

  if (captura.dias === null) {
    problemas.push({ campo: 'dias', mensaje: 'Los días tienen que ser un entero de 1 o más.' })
  }

  if (captura.fundamento.length < 6) {
    problemas.push({
      campo: 'fundamento',
      mensaje: 'Escribe el precepto. Un plazo sin fundamento no se puede auditar después.',
    })
  }

  if (captura.notas.length < LARGO_MIN_NOTAS) {
    // Sin esto, "verificado" no significa nada dentro de seis meses: nadie va a
    // poder saber contra qué texto se revisó, ni de qué fecha era ese texto.
    problemas.push({
      campo: 'notas',
      mensaje:
        'Anota contra qué texto lo revisaste y de qué fecha. Sin eso, "verificado" no significa nada dentro de seis meses.',
    })
  }

  return problemas
}

/** ¿Esta verificación cambia los números con los que ya se computó? */
export function corrigeElComputo(
  captura: CapturaVerificacion,
  original: { dias: number; unidad: string },
): boolean {
  return captura.dias !== original.dias || captura.unidad !== original.unidad
}

/**
 * El aviso cuando una corrección deja plazos vivos mal computados.
 *
 * ⚠️ **No se recalculan solos, a propósito.** Cambiarle la fecha de vencimiento
 * a un plazo sin que nadie lo vea es exactamente lo que este producto no hace:
 * el abogado agendó, avisó al cliente y quizá ya redactó contra esa fecha. Lo
 * que corresponde es decirle cuáles son y que él decida uno por uno.
 */
export function avisoDePlazosAfectados(
  cuantos: number,
  antes: { dias: number; unidad: string },
  despues: { dias: number; unidad: string },
): string {
  const n = cuantos
  return (
    `Acabas de cambiar el plazo de ${antes.dias} días ${antes.unidad} a ${despues.dias} días ${despues.unidad}, ` +
    `y hay ${n} plazo${n === 1 ? '' : 's'} corriendo que se comput${n === 1 ? 'ó' : 'aron'} con lo anterior. ` +
    `No se recalcula${n === 1 ? '' : 'n'} sol${n === 1 ? 'o' : 'os'}: revísalo${n === 1 ? '' : 's'} uno por uno y ajusta la fecha a mano donde haga falta.`
  )
}

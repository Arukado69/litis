/**
 * Calendarios semilla de días inhábiles.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA TRAMPA QUE ESTE ARCHIVO HACE VISIBLE
 * ─────────────────────────────────────────────────────────────────────────────
 * "Los días festivos" no son un solo conjunto. Conviven al menos dos listas que
 * NO coinciden, y usar la equivocada mueve un vencimiento:
 *
 *   · La Ley Federal del Trabajo (art. 74) recorre varios feriados al LUNES
 *     más cercano: primer lunes de febrero, tercer lunes de marzo, tercer
 *     lunes de noviembre.
 *   · La Ley Orgánica del Poder Judicial de la Federación (art. 163) los fija
 *     en su FECHA original: 5 de febrero, 21 de marzo, 20 de noviembre.
 *
 * En 2026 eso se ve a simple vista: el tercer lunes de marzo es el 16 y es
 * inhábil para efectos laborales, mientras que para el Poder Judicial de la
 * Federación el inhábil es el 21, que cae sábado y por tanto ya era inhábil de
 * todos modos. Un plazo de nueve días hábiles corrido sobre uno u otro
 * calendario vence en días distintos. Hay una prueba que fija exactamente ese
 * contraste, para que nadie "simplifique" fundiendo los dos calendarios.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ SEMILLA, NO FUENTE DE DERECHO
 * ─────────────────────────────────────────────────────────────────────────────
 * Estos calendarios se entregan para que el despacho arranque sin capturar 20
 * fechas a mano, NO para operar a ciegas. Faltan por definición:
 *
 *   · Los periodos vacacionales exactos, que cada órgano fija por acuerdo cada
 *     año. Los que van aquí son los usuales; se confirman contra el acuerdo
 *     publicado.
 *   · Las suspensiones de labores por contingencia, jornada electoral, cambio
 *     de sistema o causas del propio tribunal.
 *   · Los calendarios de los tribunales locales, que son 32 y distintos entre
 *     sí, y los del TFJA y las autoridades fiscales.
 *
 * El modelo de datos guarda el calendario POR ÓRGANO justamente por esto. Lo
 * que sigue es el punto de partida.
 */

import type { Calendario, PeriodoInhabil } from './calendario'

/** Un solo día inhábil, con el mismo formato que un periodo. */
function dia(
  fecha: string,
  descripcion: string,
  fundamento?: string,
): PeriodoInhabil {
  return {
    desde: fecha,
    hasta: fecha,
    motivo: 'feriado',
    descripcion,
    fundamento,
  }
}

function vacaciones(
  desde: string,
  hasta: string,
  descripcion: string,
  fundamento?: string,
): PeriodoInhabil {
  return { desde, hasta, motivo: 'vacaciones', descripcion, fundamento }
}

const LOPJF = 'Ley Orgánica del Poder Judicial de la Federación, art. 163'
const LFT74 = 'Ley Federal del Trabajo, art. 74'

/**
 * Poder Judicial de la Federación, 2026. Fechas FIJAS, no lunes recorridos.
 * Los periodos vacacionales son los usuales y deben confirmarse contra el
 * acuerdo anual del Consejo de la Judicatura Federal.
 */
export const CALENDARIO_PJF_2026: Calendario = {
  id: 'pjf-2026',
  nombre: 'Poder Judicial de la Federación 2026 (semilla)',
  vigenciaDesde: '2026-01-01',
  vigenciaHasta: '2026-12-31',
  finDeSemanaInhabil: true,
  periodos: [
    dia('2026-01-01', 'Año Nuevo', LOPJF),
    dia('2026-02-05', 'Aniversario de la Constitución', LOPJF),
    dia('2026-03-21', 'Natalicio de Benito Juárez', LOPJF),
    dia('2026-05-01', 'Día del Trabajo', LOPJF),
    dia('2026-09-16', 'Independencia', LOPJF),
    dia('2026-11-20', 'Aniversario de la Revolución', LOPJF),
    dia('2026-12-25', 'Navidad', LOPJF),
    vacaciones(
      '2026-07-16',
      '2026-07-31',
      'Primer periodo vacacional (confirmar contra el acuerdo del CJF)',
      'Acuerdo anual del Consejo de la Judicatura Federal',
    ),
    vacaciones(
      '2026-12-16',
      '2026-12-31',
      'Segundo periodo vacacional (confirmar contra el acuerdo del CJF)',
      'Acuerdo anual del Consejo de la Judicatura Federal',
    ),
  ],
}

/**
 * Materia laboral, 2026. Usa los lunes recorridos del art. 74 de la LFT, que
 * es donde se aparta del calendario judicial federal.
 */
export const CALENDARIO_LABORAL_2026: Calendario = {
  id: 'laboral-2026',
  nombre: 'Materia laboral 2026 (semilla)',
  vigenciaDesde: '2026-01-01',
  vigenciaHasta: '2026-12-31',
  finDeSemanaInhabil: true,
  periodos: [
    dia('2026-01-01', 'Año Nuevo', LFT74),
    dia('2026-02-02', 'Primer lunes de febrero', LFT74),
    dia('2026-03-16', 'Tercer lunes de marzo', LFT74),
    dia('2026-05-01', 'Día del Trabajo', LFT74),
    dia('2026-09-16', 'Independencia', LFT74),
    dia('2026-11-16', 'Tercer lunes de noviembre', LFT74),
    dia('2026-12-25', 'Navidad', LFT74),
  ],
}

export const CALENDARIOS_SEMILLA: readonly Calendario[] = [
  CALENDARIO_PJF_2026,
  CALENDARIO_LABORAL_2026,
]

/**
 * Calendario sin feriados, solo con fines de semana. Útil para pruebas y como
 * base cuando el despacho prefiere capturar todo a mano.
 */
export function calendarioBase(
  id: string,
  nombre: string,
  vigenciaDesde: string,
  vigenciaHasta: string,
): Calendario {
  return {
    id,
    nombre,
    vigenciaDesde,
    vigenciaHasta,
    finDeSemanaInhabil: true,
    periodos: [],
  }
}

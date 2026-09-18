#!/usr/bin/env node
/**
 * ¿La semilla está en el proyecto de Supabase?
 *
 *   npm run verificar:semilla
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO EXISTE APARTE DE `correr.sh`
 * ─────────────────────────────────────────────────────────────────────────────
 * `correr.sh` aplica TODAS las migraciones a un Postgres de usar y tirar, así
 * que ahí la semilla siempre está y siempre pasa. Prueba que la `0008`
 * **funciona**. No dice nada de si está **aplicada**.
 *
 * Y esa es la que falló: la `0008` estuvo sin aplicar mucho tiempo con el
 * andamio en verde y `semilla.test.ts` en verde — porque ese test coteja el SQL
 * contra las constantes de TypeScript, los dos en el repositorio, y pasa aunque
 * ese SQL jamás se haya ejecutado. Como los calendarios y el catálogo viven en
 * la BASE (CLAUDE.md §5.1), el motor de plazos se quedó sin con qué contar y
 * nada lo dijo.
 *
 * Una migración de datos solo se verifica contando filas. Esto las cuenta.
 *
 * ⚠️ Va con la clave ANÓNIMA, no con la de servicio, y no es por comodidad: así
 * es como la aplicación lee de verdad el catálogo compartido. Las políticas de
 * `calendarios` y `plazos_catalogo` sirven las filas con `despacho_id is null`
 * a todo el mundo, así que esto no comprueba solo que las filas existan —
 * comprueba que sean ALCANZABLES. Si algún día una política las tapara, el
 * motor se quedaría igual de ciego que si nunca se hubieran sembrado, y esto lo
 * cazaría. No se necesita ningún secreto y no escribe nada.
 *
 * ⚠️ Sin llaves NO pasa: se detiene con estado distinto de cero. Una
 * verificación que se declara conforme cuando no pudo verificar es exactamente
 * el fallo que este script existe para evitar (misma doctrina que la regla 15).
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !llave) {
  console.error('No se puede verificar: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  console.error('No es un "pasa": es que no se pudo preguntar. Cárgalas y vuelve a correr.')
  process.exit(2)
}

/** Lo que la `0008` promete dejar en la base. Espejo de la migración. */
const ESPERADO = {
  calendarios: ['laboral-2026', 'pjf-2026'],
  diasInhabiles: { 'pjf-2026': 9, 'laboral-2026': 7 },
  entradasCatalogo: 16,
  // El contraste que ordena todo el motor: la LOPJF fija el natalicio de Juárez
  // en su fecha y la LFT lo recorre al tercer lunes. Si estos dos coinciden,
  // alguien fundió los calendarios y los plazos laborales se están contando con
  // los inhábiles federales.
  marzo: { 'pjf-2026': '2026-03-21', 'laboral-2026': '2026-03-16' },
}

async function consultar(recurso) {
  const respuesta = await fetch(`${url}/rest/v1/${recurso}`, {
    headers: { apikey: llave, Authorization: `Bearer ${llave}` },
  })
  if (!respuesta.ok) {
    throw new Error(`${recurso} → HTTP ${respuesta.status}: ${await respuesta.text()}`)
  }
  return respuesta.json()
}

const fallas = []
function verificar(nombre, ok, detalle = '') {
  console.log(`${ok ? 'PASA ' : 'FALLA'}  ${nombre}${ok || !detalle ? '' : ` — ${detalle}`}`)
  if (!ok) fallas.push(nombre)
}

try {
  // ── Los calendarios compartidos ──────────────────────────────────────────
  const calendarios = await consultar(
    'calendarios?select=id,clave&despacho_id=is.null&order=clave',
  )
  const claves = calendarios.map((c) => c.clave).sort()
  verificar(
    'los dos calendarios semilla están en la base',
    JSON.stringify(claves) === JSON.stringify(ESPERADO.calendarios),
    `encontrados: ${claves.length ? claves.join(', ') : 'NINGUNO'}`,
  )

  // ── Sus días inhábiles ───────────────────────────────────────────────────
  // Un calendario sin inhábiles cuenta como si todo fuera hábil: el error que
  // hace perder un término justo en los puentes.
  for (const [clave, cuantos] of Object.entries(ESPERADO.diasInhabiles)) {
    const cal = calendarios.find((c) => c.clave === clave)
    if (!cal) {
      verificar(`${clave} trae sus días inhábiles`, false, 'no existe el calendario')
      continue
    }
    const dias = await consultar(
      `dias_inhabiles?select=desde,hasta&calendario_id=eq.${cal.id}`,
    )
    verificar(
      `${clave} trae sus ${cuantos} días inhábiles`,
      dias.length === cuantos,
      `hay ${dias.length}`,
    )

    const marzo = dias.filter((d) => d.desde >= '2026-03-01' && d.desde <= '2026-03-31')
    verificar(
      `${clave} fija marzo donde debe (${ESPERADO.marzo[clave]})`,
      marzo.length === 1 && marzo[0].desde === ESPERADO.marzo[clave],
      `encontrado: ${marzo.map((d) => d.desde).join(', ') || 'ninguno'}`,
    )
  }

  // ── El catálogo de plazos ────────────────────────────────────────────────
  const catalogo = await consultar(
    'plazos_catalogo?select=clave,fundamento,verificado_por,verificado_el&despacho_id=is.null',
  )
  verificar(
    `el catálogo compartido tiene sus ${ESPERADO.entradasCatalogo} entradas`,
    catalogo.length === ESPERADO.entradasCatalogo,
    `hay ${catalogo.length}`,
  )

  // ── REGLA 4 ──────────────────────────────────────────────────────────────
  const verificadas = catalogo.filter((e) => e.verificado_por || e.verificado_el)
  verificar(
    'NINGUNA entrada compartida está marcada como verificada (regla 4)',
    verificadas.length === 0,
    `marcadas: ${verificadas.map((e) => e.clave).join(', ')}`,
  )

  const sinFundamento = catalogo.filter((e) => !e.fundamento?.trim())
  verificar(
    'toda entrada del catálogo cita su fundamento',
    sinFundamento.length === 0,
    `sin fundamento: ${sinFundamento.map((e) => e.clave).join(', ')}`,
  )
} catch (error) {
  console.error(`\nNo se pudo terminar de verificar: ${error.message}`)
  process.exit(2)
}

if (fallas.length > 0) {
  console.error(`\n${fallas.length} comprobación(es) en falla.`)
  console.error('Si la semilla no está, aplica `supabase/migrations/0008_semilla_calendarios_plazos.sql`')
  console.error('en el SQL Editor. Es idempotente: reaplicarla no duplica nada.')
  process.exit(1)
}

console.log('\n── la semilla está en la base ──')

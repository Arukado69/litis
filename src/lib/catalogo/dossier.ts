/**
 * El expediente de trabajo para verificar el catálogo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ ES Y QUÉ NO ES
 * ─────────────────────────────────────────────────────────────────────────────
 * R10 construyó la pantalla donde un abogado firma cada plazo. Lo que faltaba
 * no era código: era la firma. Esto **no la sustituye** —regla 4: nada sale de
 * fábrica como verificado, y verificar es acto de quien puede firmar—. Lo que
 * hace es quitarle al abogado todo el trabajo que NO es de abogado: qué hay
 * hoy, qué dice cada entrada que calcula, contra qué texto hay que cotejarla y
 * qué preguntas deja abiertas antes de sentarse.
 *
 * ⚠️ **Aquí no se propone ningún número.** Ni una corrección, ni un "debería
 * ser". Todo lo que este archivo produce es o un dato que ya está en la base o
 * una observación MECÁNICA sobre la forma de la cita. Un documento de apoyo que
 * sugiere plazos es un catálogo sin verificar disfrazado de revisión.
 */

/** Una entrada del catálogo tal como vive en la base. */
export type EntradaDelCatalogo = {
  id: string
  clave: string | null
  regimen: string
  etiqueta: string
  dias: number
  unidad: string
  fundamento: string | null
  nota: string | null
  verificado_el: string | null
}

/** Una vía que el sistema ofrece al abrir un expediente. */
export type ViaDelSistema = { id: string; nombre: string; regimen: string }

// ── Hueco de cobertura ──────────────────────────────────────────────────────

export type HuecoDeCobertura = {
  regimen: string
  vias: readonly ViaDelSistema[]
}

/**
 * Los regímenes que el sistema deja elegir y para los que no hay UN SOLO plazo.
 *
 * ⚠️ Esto no es un detalle de catálogo: es la promesa central del producto
 * apagada para esas vías. Quien abra un juicio ordinario civil llega a la
 * pantalla de cómputo, abre el selector de plazos y lo encuentra vacío — así
 * que captura el término a mano, sin fundamento, y el sistema le marca el
 * cómputo como no verificado. Funciona, pero es justo el trabajo que venía a
 * ahorrar.
 *
 * Se mide contra las VÍAS y no contra la lista de regímenes: un régimen que
 * nadie puede elegir no le falta a nadie.
 */
export function huecosDeCobertura(
  vias: readonly ViaDelSistema[],
  entradas: readonly EntradaDelCatalogo[],
): HuecoDeCobertura[] {
  const conEntradas = new Set(entradas.map((e) => e.regimen))
  const porRegimen = new Map<string, ViaDelSistema[]>()

  for (const via of vias) {
    if (conEntradas.has(via.regimen)) continue
    const acumulado = porRegimen.get(via.regimen) ?? []
    acumulado.push(via)
    porRegimen.set(via.regimen, acumulado)
  }

  return [...porRegimen.entries()]
    .map(([regimen, suyas]) => ({ regimen, vias: suyas }))
    .sort((a, b) => b.vias.length - a.vias.length)
}

// ── Citas que no alcanzan para verificar ────────────────────────────────────

export type CitaImprecisa = {
  fundamento: string
  /** Las entradas que lo citan, con plazos distintos. */
  entradas: readonly { etiqueta: string; dias: number; unidad: string }[]
}

/**
 * Un mismo artículo citado por entradas con plazos DISTINTOS.
 *
 * ⚠️ No dice que la cita esté mal: dice que **no alcanza para verificarla**. Si
 * tres entradas de 9, 6 y 3 días señalan el mismo artículo, ese artículo
 * distingue por fracción o por supuesto, y la cita no dice cuál — así que quien
 * verifique tiene que reconstruir a qué corresponde cada número antes de poder
 * confirmarlo. Y el abogado que lo lea en pantalla, junto al vencimiento, se
 * queda igual.
 *
 * Es una observación mecánica sobre la forma de la cita, no sobre el derecho.
 */
export function citasImprecisas(
  entradas: readonly EntradaDelCatalogo[],
): CitaImprecisa[] {
  const porFundamento = new Map<string, EntradaDelCatalogo[]>()

  for (const entrada of entradas) {
    const cita = entrada.fundamento?.trim()
    if (!cita) continue
    const acumulado = porFundamento.get(cita) ?? []
    acumulado.push(entrada)
    porFundamento.set(cita, acumulado)
  }

  return [...porFundamento.entries()]
    .filter(([, suyas]) => new Set(suyas.map((e) => e.dias)).size > 1)
    .map(([fundamento, suyas]) => ({
      fundamento,
      entradas: suyas.map((e) => ({
        etiqueta: e.etiqueta,
        dias: e.dias,
        unidad: e.unidad,
      })),
    }))
    .sort((a, b) => b.entradas.length - a.entradas.length)
}

// ── Entradas sin fundamento ─────────────────────────────────────────────────

/**
 * Las que no citan nada.
 *
 * Una entrada sin fundamento no se puede verificar: no hay contra qué. En la
 * semilla no debería haber ninguna —hay prueba de eso— pero una capturada a
 * mano por el despacho sí puede llegar así, y entonces conviene saberlo antes
 * de la sesión y no durante.
 */
export function sinFundamento(
  entradas: readonly EntradaDelCatalogo[],
): EntradaDelCatalogo[] {
  return entradas.filter((e) => !e.fundamento?.trim())
}

// ── El documento ────────────────────────────────────────────────────────────

const ADVERTENCIA = `> **Este documento no verifica nada.** Es el material de trabajo para que
> alguien que pueda firmar lo haga. No propone plazos, no corrige números y no
> opina sobre el derecho aplicable: solo dice qué hay hoy en la base, qué
> calcula cada entrada y qué preguntas deja abierta la forma en que está
> escrita. La verificación se asienta en \`/panel/catalogo\`, entrada por
> entrada, y ahí queda la constancia de quién la hizo y contra qué texto.`

/**
 * Deja un texto libre en condiciones de ir dentro de una celda de tabla.
 *
 * ⚠️ Un `|` en el fundamento —«CNPCyF art. 1079 | art. 1080»— parte la celda en
 * dos y el renderizador se come la mitad: el abogado verificaría contra una
 * cita a la que le falta un pedazo, sin que nada se vea roto. Y un salto de
 * línea en la nota rompe la tabla entera. Los dos vienen de texto que teclea
 * una persona.
 */
function enCelda(texto: string): string {
  return texto.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim()
}

/**
 * Cómo se escribe «9 días hábiles».
 *
 * Entra como parámetro en vez de importarse: este archivo no importa nada, y
 * eso es lo que deja que el generador corra con el `--experimental-strip-types`
 * de Node sin resolver el alias `@/`. El rótulo sigue viviendo en UN lugar
 * (`UNIDAD_ETIQUETA` en `lib/plazos/regimenes`), que es quien lo pasa.
 */
export type EtiquetaDeUnidad = (unidad: string) => string

function renglonDeEntrada(
  e: EntradaDelCatalogo,
  n: number,
  unidadEn: EtiquetaDeUnidad,
): string {
  const partes = [
    `### ${n}. ${e.etiqueta}`,
    '',
    `| | |`,
    `|---|---|`,
    `| **Lo que el sistema computa hoy** | ${e.dias} ${unidadEn(e.unidad)} |`,
    `| **Régimen** | \`${e.regimen}\` |`,
    `| **Cita registrada** | ${
      e.fundamento?.trim()
        ? enCelda(e.fundamento)
        : '⚠️ **ninguna** — sin esto no hay contra qué cotejar'
    } |`,
    `| **Clave** | \`${e.clave ?? '—'}\` |`,
  ]

  if (e.nota?.trim()) {
    partes.push(`| **Advertencia que ya trae** | ${enCelda(e.nota)} |`)
  }

  partes.push(
    '',
    '**Para firmarla hace falta contestar:**',
    '',
    `- ¿El texto vigente dice ${e.dias}, y son ${unidadEn(e.unidad)}?`,
    '- ¿Desde cuándo corre: la notificación, el requerimiento, otro hecho?',
    '- ¿Hay supuestos en que ese plazo es otro, o no corre?',
    '- ¿Qué reforma es la última que lo tocó, y de qué fecha es el texto que estás leyendo?',
    '',
    '**Nota de verificación** (obligatoria en la pantalla: contra qué texto y de qué fecha):',
    '',
    '```',
    '',
    '```',
    '',
  )

  return partes.join('\n')
}

/**
 * Arma el documento completo.
 *
 * Recibe todo ya leído —incluida la fecha— para poder probarse sin base y sin
 * reloj, como el resto del dominio.
 */
export function armarDossier({
  entradas,
  vias,
  generadoEl,
  proyecto,
  unidadEn = (u) => `días ${u}`,
}: {
  entradas: readonly EntradaDelCatalogo[]
  vias: readonly ViaDelSistema[]
  generadoEl: string
  proyecto: string
  unidadEn?: EtiquetaDeUnidad
}): string {
  const huecos = huecosDeCobertura(vias, entradas)
  const imprecisas = citasImprecisas(entradas)
  const huerfanas = sinFundamento(entradas)

  const viasCubiertas = vias.filter((v) =>
    entradas.some((e) => e.regimen === v.regimen),
  ).length

  const lineas: string[] = [
    '# Catálogo de plazos — material para verificar',
    '',
    `Generado el ${generadoEl} desde \`${proyecto}\`, leyendo la base, no el repositorio.`,
    '',
    ADVERTENCIA,
    '',
    '## De un vistazo',
    '',
    '| | |',
    '|---|---|',
    `| Entradas en el catálogo compartido | ${entradas.length} |`,
    // ⚠️ Aquí NO va un «ya verificadas». El generador lee el catálogo
    // compartido, y verificar COPIA la entrada al despacho (CLAUDE.md §5.16):
    // una fila compartida no puede llevar firma nunca. Ese renglón habría dicho
    // «0» para siempre —incluso con las 16 ya firmadas— y es lo contrario de lo
    // que este documento viene a informar.
    `| Vías con al menos un plazo disponible | ${viasCubiertas} de ${vias.length} |`,
    `| Citas que no alcanzan para verificar | ${imprecisas.length} |`,
    `| Entradas sin fundamento | ${huerfanas.length} |`,
    '',
  ]

  // ── Huecos ────────────────────────────────────────────────────────────────
  if (huecos.length > 0) {
    const viasHuecas = huecos.reduce((n, h) => n + h.vias.length, 0)
    lineas.push(
      '## Lo primero: las vías que no tienen ni un plazo',
      '',
      `**${viasHuecas} de las ${vias.length} vías** que el sistema deja elegir no`,
      'ofrecen una sola entrada de catálogo. Quien abra uno de esos asuntos llega a',
      'la pantalla de cómputo, abre el selector y lo encuentra vacío: captura el',
      'término a mano, sin fundamento, y el cómputo queda marcado como no',
      'verificado. Funciona — es justo el trabajo que el producto venía a ahorrar.',
      '',
      'Verificar lo que ya hay y dejar esto igual deja la mitad del catálogo en pie.',
      '',
    )
    for (const hueco of huecos) {
      const cuantas = hueco.vias.length
      lineas.push(
        `### \`${hueco.regimen}\` — ${cuantas} ${cuantas === 1 ? 'vía' : 'vías'} sin plazos`,
        '',
      )
      for (const via of hueco.vias) {
        lineas.push(`- ${via.nombre} (\`${via.id}\`)`)
      }
      lineas.push('')
    }
  }

  // ── Citas imprecisas ──────────────────────────────────────────────────────
  if (imprecisas.length > 0) {
    lineas.push(
      '## Citas que no alcanzan para verificar',
      '',
      'Un mismo artículo citado por entradas con plazos distintos. No quiere decir',
      'que la cita esté mal: quiere decir que ese artículo distingue por fracción o',
      'por supuesto y la cita no dice cuál. Quien verifique tiene que reconstruir a',
      'qué corresponde cada número, y el abogado que la lea en pantalla junto al',
      'vencimiento se queda igual.',
      '',
    )
    for (const cita of imprecisas) {
      lineas.push(`**${cita.fundamento}**`, '')
      for (const e of cita.entradas) {
        lineas.push(`- ${e.dias} ${unidadEn(e.unidad)} — ${e.etiqueta}`)
      }
      lineas.push('')
    }
  }

  if (huerfanas.length > 0) {
    lineas.push('## Entradas sin fundamento', '')
    lineas.push(
      'No se pueden verificar: no hay contra qué cotejarlas. O se les pone la cita,',
      'o se retiran del catálogo.',
      '',
    )
    for (const e of huerfanas) lineas.push(`- ${e.etiqueta} (\`${e.clave ?? e.id}\`)`)
    lineas.push('')
  }

  // ── Una por una ───────────────────────────────────────────────────────────
  lineas.push(
    '## Entrada por entrada',
    '',
    'En el orden en que conviene revisarlas: agrupadas por régimen, porque se',
    'cotejan contra el mismo ordenamiento y abrirlo una vez cuesta menos que',
    'cuatro.',
    '',
  )

  const regimenes = [...new Set(entradas.map((e) => e.regimen))].sort()
  let n = 0
  for (const regimen of regimenes) {
    lineas.push(`## Régimen \`${regimen}\``, '')
    for (const entrada of entradas.filter((e) => e.regimen === regimen)) {
      n += 1
      lineas.push(renglonDeEntrada(entrada, n, unidadEn))
    }
  }

  return lineas.join('\n')
}

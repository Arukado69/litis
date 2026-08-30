/**
 * Detección de conflicto de interés (motor puro, sin efectos).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ PROBLEMA RESUELVE
 * ─────────────────────────────────────────────────────────────────────────────
 * Aceptar un asunto contra alguien que ya es cliente del despacho es de las
 * pocas cosas que pueden costar la cédula, no solo el cliente. En un despacho
 * de tres personas eso se "resuelve" preguntando en voz alta si a alguien le
 * suena el nombre. Funciona hasta que el despacho tiene cuatrocientos
 * expedientes, o hasta que la contraparte se llama distinto de como se llamaba
 * hace tres años.
 *
 * Este motor cruza a las partes de un asunto NUEVO contra todo lo que el
 * despacho ya registró —clientes y contrapartes— y devuelve hallazgos con su
 * evidencia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LO QUE ESTE MOTOR NO HACE, A PROPÓSITO
 * ─────────────────────────────────────────────────────────────────────────────
 * No decide. Devuelve `impedimento` o `revisar`, nunca "puedes aceptarlo".
 * Determinar si un conflicto es dispensable, si el asunto es conexo o si basta
 * el consentimiento informado de ambos clientes es un juicio profesional que
 * depende del código de ética aplicable y de los hechos. Un software que
 * dictaminara eso estaría dando una opinión que no le corresponde.
 *
 * Tampoco intenta adivinar con puntajes difusos. Cada hallazgo dice EN QUÉ
 * coincidió —RFC, nombre idéntico, nombre contenido— para que la persona que
 * lo revisa pueda descartarlo en cinco segundos si es un homónimo. Un
 * porcentaje de similitud que nadie puede auditar produce dos conductas malas:
 * ignorar todo, o paralizarse con cada falso positivo.
 */

export type NivelConflicto = 'impedimento' | 'revisar'

export type TipoCoincidencia = 'rfc' | 'nombre_identico' | 'nombre_contenido'

export const COINCIDENCIA_ETIQUETA: Record<TipoCoincidencia, string> = {
  rfc: 'RFC idéntico',
  nombre_identico: 'Nombre idéntico',
  nombre_contenido: 'Nombre muy parecido',
}

/** Cómo se relaciona una persona ya registrada con el despacho. */
export type Relacion = 'cliente_activo' | 'cliente_anterior' | 'contraparte'

export const RELACION_ETIQUETA: Record<Relacion, string> = {
  cliente_activo: 'Cliente activo',
  cliente_anterior: 'Cliente anterior',
  contraparte: 'Contraparte en otro asunto',
}

/** Una persona que el despacho ya tiene registrada, con su contexto. */
export interface RegistroExistente {
  id: string
  nombre: string
  rfc: string | null
  relacion: Relacion
  expedienteId: string
  caratula: string
}

/** Una parte del asunto que se está por aceptar. */
export interface ParteEnEstudio {
  nombre: string
  rfc: string | null
  /** ¿Es la parte que representaríamos, o la de enfrente? */
  esNuestraParte: boolean
}

export interface Hallazgo {
  nivel: NivelConflicto
  coincidencia: TipoCoincidencia
  /** La parte del asunto nuevo que disparó el hallazgo. */
  parte: ParteEnEstudio
  registro: RegistroExistente
  /** Por qué importa, en una línea que se pueda leer en la pantalla de alta. */
  motivo: string
}

export interface ResultadoRevision {
  hallazgos: readonly Hallazgo[]
  /** El nivel más grave encontrado. `null` si no hubo nada. */
  nivelMaximo: NivelConflicto | null
  /**
   * Siempre `true` mientras haya hallazgos: el alta puede continuar, pero
   * alguien tiene que dejar constancia de que lo revisó.
   */
  requiereConstancia: boolean
}

const SUFIJOS_SOCIETARIOS = [
  'SA DE CV',
  'S DE RL DE CV',
  'S DE RL',
  'SAPI DE CV',
  'SAB DE CV',
  'SC',
  'AC',
  'SA',
  'SAPI',
  'SAB',
  'SOFOM ENR',
  'SOFOM ER',
  'SOFOM',
]

/**
 * Deja un nombre en su forma comparable: sin acentos, sin puntuación, sin
 * sufijos societarios y sin espacios de más.
 *
 * Los sufijos se quitan porque "Constructora XYZ, S.A. de C.V." y
 * "CONSTRUCTORA XYZ SA DE CV" son la misma empresa escrita por dos capturistas
 * distintos, y un cotejo literal las trata como personas diferentes — que es
 * justo el falso negativo que hace inútil la revisión.
 *
 * DOS DECISIONES QUE PARECEN DETALLE Y NO LO SON:
 *
 *   · El punto UNE y la coma SEPARA. "S.A." tiene que quedar "SA" para que el
 *     recorte del sufijo lo reconozca; si el punto se volviera espacio
 *     quedaría "S A DE C V" y ningún sufijo empataría. En cambio "Pérez,
 *     Gómez" sí son dos palabras.
 *   · La Ñ se pliega a N. Aquí conviene equivocarse por exceso: quien captura
 *     "Munoz" y quien captura "Muñoz" se refieren a la misma persona, y en una
 *     revisión de conflictos un falso positivo cuesta diez segundos mientras
 *     que un falso negativo cuesta el impedimento que nadie vio.
 */
export function normalizarNombre(nombre: string): string {
  let n = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // marcas de acento que deja NFD, sin caracteres crudos en el fuente
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Se recorta el sufijo solo al final, y en orden de más largo a más corto
  // para que "SA DE CV" no se coma primero el "SA".
  for (const sufijo of SUFIJOS_SOCIETARIOS) {
    if (n.endsWith(` ${sufijo}`)) {
      n = n.slice(0, -(sufijo.length + 1)).trim()
      break
    }
  }

  return n
}

/** El RFC comparable: sin espacios ni guiones, en mayúsculas. */
export function normalizarRfc(rfc: string | null): string | null {
  if (!rfc) return null
  const limpio = rfc.toUpperCase().replace(/[^A-Z0-9Ñ&]/g, '')
  // Un RFC válido tiene 12 (moral) o 13 (física) caracteres. Por debajo de 10
  // casi seguro es un dato incompleto, y cotejar por él produciría falsos
  // positivos en cadena.
  return limpio.length >= 10 ? limpio : null
}

/** Palabras que no distinguen a nadie y no deben sostener una coincidencia. */
const VACIAS = new Set([
  'DE',
  'DEL',
  'LA',
  'LAS',
  'EL',
  'LOS',
  'Y',
  'E',
  'GRUPO',
  // Ya normalizado: la Ñ se pliega a N antes de llegar aquí.
  'COMPANIA',
])

function tokensSignificativos(nombre: string): string[] {
  return normalizarNombre(nombre)
    .split(' ')
    .filter((t) => t.length > 1 && !VACIAS.has(t))
}

/**
 * ¿Los nombres coinciden, y de qué forma?
 *
 * `nombre_contenido` exige que TODOS los tokens significativos del más corto
 * estén en el más largo, y que sean al menos dos. Con un solo token
 * ("Constructora") coincidiría media ciudad.
 */
export function compararNombres(
  a: string,
  b: string,
): TipoCoincidencia | null {
  const na = normalizarNombre(a)
  const nb = normalizarNombre(b)
  if (na.length === 0 || nb.length === 0) return null
  if (na === nb) return 'nombre_identico'

  const ta = tokensSignificativos(a)
  const tb = tokensSignificativos(b)
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  if (corto.length < 2) return null

  const conjunto = new Set(largo)
  return corto.every((t) => conjunto.has(t)) ? 'nombre_contenido' : null
}

/**
 * Qué tan grave es el hallazgo.
 *
 * La regla dura: representar a alguien CONTRA un cliente activo es el supuesto
 * clásico de impedimento. Todo lo demás se marca para revisión humana, porque
 * su gravedad depende de si los asuntos son conexos y de qué diga el código de
 * ética aplicable — cosas que este motor no puede saber.
 */
function evaluar(
  parte: ParteEnEstudio,
  registro: RegistroExistente,
): { nivel: NivelConflicto; motivo: string } | null {
  const esContraria = !parte.esNuestraParte

  // Volver a representar a quien ya es —o fue— cliente del despacho no es
  // conflicto: es el caso más común que hay, el cliente que regresa. Marcarlo
  // llenaría de hallazgos cada alta de asunto repetido, y una alerta que
  // siempre suena es una alerta que nadie lee.
  if (
    !esContraria &&
    (registro.relacion === 'cliente_activo' ||
      registro.relacion === 'cliente_anterior')
  ) {
    return null
  }

  if (esContraria && registro.relacion === 'cliente_activo') {
    return {
      nivel: 'impedimento',
      motivo: `Estarías actuando CONTRA un cliente activo del despacho, que ya lleva el asunto "${registro.caratula}".`,
    }
  }

  if (esContraria && registro.relacion === 'cliente_anterior') {
    return {
      nivel: 'revisar',
      motivo: `La contraparte fue cliente del despacho en "${registro.caratula}". Revisa si el asunto nuevo es conexo y qué información reservada se conoce de ella.`,
    }
  }

  if (!esContraria && registro.relacion === 'contraparte') {
    return {
      nivel: 'revisar',
      motivo: `A esta persona la tienes registrada como contraparte en "${registro.caratula}". Confirma que no haya posiciones encontradas.`,
    }
  }

  if (esContraria && registro.relacion === 'contraparte') {
    return {
      nivel: 'revisar',
      motivo: `Ya figura como contraparte en "${registro.caratula}". No es impedimento por sí solo; sirve para acumular antecedentes.`,
    }
  }

  return {
    nivel: 'revisar',
    motivo: `Coincide con un registro previo en "${registro.caratula}" (${RELACION_ETIQUETA[registro.relacion].toLowerCase()}).`,
  }
}

/**
 * Cruza las partes de un asunto nuevo contra el padrón del despacho.
 *
 * Devuelve los hallazgos ordenados por gravedad, y dentro de cada nivel, por
 * fuerza de la evidencia: primero el RFC, que no admite discusión, y al final
 * los parecidos de nombre, que suelen ser homónimos.
 */
export function revisarConflictos(args: {
  partes: readonly ParteEnEstudio[]
  padron: readonly RegistroExistente[]
}): ResultadoRevision {
  const hallazgos: Hallazgo[] = []

  for (const parte of args.partes) {
    const rfcParte = normalizarRfc(parte.rfc)

    for (const registro of args.padron) {
      const rfcRegistro = normalizarRfc(registro.rfc)

      let coincidencia: TipoCoincidencia | null = null
      if (rfcParte && rfcRegistro && rfcParte === rfcRegistro) {
        coincidencia = 'rfc'
      } else {
        coincidencia = compararNombres(parte.nombre, registro.nombre)
      }
      if (!coincidencia) continue

      const evaluacion = evaluar(parte, registro)
      // `null` significa coincidencia benigna: el cliente que regresa.
      if (!evaluacion) continue

      hallazgos.push({
        nivel: evaluacion.nivel,
        coincidencia,
        parte,
        registro,
        motivo: evaluacion.motivo,
      })
    }
  }

  const pesoNivel: Record<NivelConflicto, number> = {
    impedimento: 0,
    revisar: 1,
  }
  const pesoCoincidencia: Record<TipoCoincidencia, number> = {
    rfc: 0,
    nombre_identico: 1,
    nombre_contenido: 2,
  }

  hallazgos.sort(
    (a, b) =>
      pesoNivel[a.nivel] - pesoNivel[b.nivel] ||
      pesoCoincidencia[a.coincidencia] - pesoCoincidencia[b.coincidencia],
  )

  const nivelMaximo: NivelConflicto | null = hallazgos.some(
    (h) => h.nivel === 'impedimento',
  )
    ? 'impedimento'
    : hallazgos.length > 0
      ? 'revisar'
      : null

  return {
    hallazgos,
    nivelMaximo,
    requiereConstancia: hallazgos.length > 0,
  }
}

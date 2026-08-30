/**
 * Regímenes procesales: cuándo surte efectos una notificación y cómo corre el
 * plazo en cada materia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL ERROR QUE ESTE MÓDULO EXISTE PARA EVITAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Entre la notificación y el primer día del plazo hay DOS saltos, no uno:
 *
 *     notificación ──▶ surte efectos ──▶ empieza a correr el plazo
 *
 * En materia mercantil la notificación surte efectos al día siguiente, y el
 * plazo empieza a correr al día siguiente de que surtió. Notificado el lunes,
 * el plazo arranca el MIÉRCOLES. Quien cuenta desde el lunes se equivoca por
 * dos días y presenta fuera de término; quien cuenta desde el martes se
 * equivoca por uno. En amparo, en cambio, hay tipos de notificación que surten
 * efectos el mismo día en que se practican, y ahí el salto es uno solo.
 *
 * Esa asimetría entre ordenamientos es la razón de que este archivo sea una
 * tabla explícita y no un `if` escondido en el motor.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ ESTADO DE VERIFICACIÓN — LEER ANTES DE CONFIAR
 * ─────────────────────────────────────────────────────────────────────────────
 * Todo lo que se entrega aquí es SEMILLA NO VERIFICADA. Es un punto de partida
 * razonable, no una fuente de derecho, y por tres motivos concretos:
 *
 *   · Los ordenamientos se reforman. El Código Nacional de Procedimientos
 *     Civiles y Familiares (DOF 07/06/2023) está sustituyendo de forma
 *     escalonada a los códigos procesales civiles y familiares de las
 *     entidades, con fecha límite de entrada en vigor el 1 de abril de 2027.
 *     Durante esa transición conviven dos regímenes distintos según la entidad
 *     y según la fecha de inicio del asunto. Un catálogo estático miente.
 *   · Las reglas locales varían por entidad federativa.
 *   · La interpretación de un plazo concreto depende del caso.
 *
 * Por eso cada régimen y cada plazo del catálogo llevan `verificacion` y el
 * despacho debe confirmarlos contra el texto vigente antes de operar con
 * ellos. El motor propaga ese estado hasta la pantalla: un cómputo apoyado en
 * semilla no verificada se muestra marcado como tal. La plataforma calcula y
 * avisa; NO dictamina. La responsabilidad profesional sigue siendo del
 * abogado, y el producto está diseñado para recordárselo, no para dejar que
 * lo olvide.
 */

export type EstadoVerificacion =
  /** Viene de fábrica. Nadie del despacho lo ha confirmado. */
  | 'semilla_no_verificada'
  /** Un abogado del despacho lo revisó contra el texto vigente. */
  | 'verificado_por_despacho'

export type IdRegimen =
  | 'mercantil'
  | 'civil_federal'
  | 'civil_familiar_local'
  | 'amparo'
  | 'laboral'
  | 'contencioso_administrativo'
  | 'fiscal_administrativo'
  | 'penal_acusatorio'

export type TipoNotificacion =
  /** En persona, en el domicilio señalado o en el local del órgano. */
  | 'personal'
  /** Lista, boletín judicial o estrados del órgano. */
  | 'lista'
  /** Oficio a autoridades. */
  | 'oficio'
  /** Buzón electrónico / juicio en línea / expediente digital. */
  | 'electronica'
  /** Edictos. */
  | 'edictos'

export const TIPO_NOTIFICACION_ETIQUETA: Record<TipoNotificacion, string> = {
  personal: 'Personal',
  lista: 'Por lista, boletín o estrados',
  oficio: 'Por oficio',
  electronica: 'Electrónica (buzón / juicio en línea)',
  edictos: 'Por edictos',
}

/** Días hábiles es la regla general; naturales, la excepción expresa. */
export type UnidadPlazo = 'habiles' | 'naturales'

export const UNIDAD_ETIQUETA: Record<UnidadPlazo, string> = {
  habiles: 'días hábiles',
  naturales: 'días naturales',
}

/** Cuándo surte efectos una notificación de este tipo en este régimen. */
export interface ReglaSurtimiento {
  tipo: TipoNotificacion
  cuando: 'mismo_dia' | 'dia_siguiente'
  fundamento: string
  /** Matiz que el motor arrastra al resultado cuando aplica esta regla. */
  nota?: string
}

export interface RegimenProcesal {
  id: IdRegimen
  nombre: string
  /** El ordenamiento que rige el cómputo. */
  ordenamiento: string
  descripcion: string
  unidadPorDefecto: UnidadPlazo
  /**
   * ¿El día del vencimiento se cuenta dentro del plazo? En los ordenamientos
   * mexicanos vigentes, sí, y está dicho con todas sus letras. Se deja como
   * parámetro porque es justo la regla que la gente asume al revés.
   */
  incluyeDiaVencimiento: boolean
  /** Regla de arranque, en prosa, para mostrarla junto al resultado. */
  fundamentoComputo: string
  reglas: readonly ReglaSurtimiento[]
  /** Se copian tal cual al resultado del cómputo. */
  advertencias: readonly string[]
  verificacion: EstadoVerificacion
}

/**
 * Regla de arranque común a los ordenamientos procesales mexicanos: el plazo
 * corre desde el día siguiente al que surtió efectos la notificación. Lo que
 * cambia entre regímenes es CUÁNDO surte efectos, no esto.
 */
const ARRANQUE_DIA_SIGUIENTE =
  'El plazo empieza a correr el día siguiente a aquel en que surte efectos la notificación, y el día del vencimiento se cuenta dentro del plazo.'

export const REGIMENES: Record<IdRegimen, RegimenProcesal> = {
  mercantil: {
    id: 'mercantil',
    nombre: 'Mercantil',
    ordenamiento: 'Código de Comercio',
    descripcion:
      'Juicios ordinario, ejecutivo y oral mercantiles. Es el régimen donde el doble salto (surte efectos al día siguiente + corre al día siguiente) muerde más seguido.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Código de Comercio, art. 1075.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'Código de Comercio, art. 1075',
      },
      {
        tipo: 'lista',
        cuando: 'dia_siguiente',
        fundamento: 'Código de Comercio, art. 1075',
      },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'Código de Comercio, art. 1075',
        nota: 'Verifica la regla del sistema electrónico del órgano: algunos fijan el surtimiento por la apertura del acuse y no por el envío.',
      },
      {
        tipo: 'oficio',
        cuando: 'dia_siguiente',
        fundamento: 'Código de Comercio, art. 1075',
      },
      {
        tipo: 'edictos',
        cuando: 'dia_siguiente',
        fundamento: 'Código de Comercio, art. 1075',
        nota: 'En edictos cuenta la última publicación, no la primera. Captura esa fecha.',
      },
    ],
    advertencias: [
      'En mercantil hay dos saltos entre la notificación y el primer día del plazo. Confirma la fecha de la notificación con el acuse, no con la del acuerdo.',
    ],
    verificacion: 'semilla_no_verificada',
  },

  civil_federal: {
    id: 'civil_federal',
    nombre: 'Civil federal',
    ordenamiento: 'Código Federal de Procedimientos Civiles',
    descripcion:
      'Procedimientos civiles del fuero federal y supletoriedad del CFPC donde así se prevea.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Código Federal de Procedimientos Civiles, art. 321.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'CFPC, arts. 321 y relativos al surtimiento',
      },
      { tipo: 'lista', cuando: 'dia_siguiente', fundamento: 'CFPC, art. 321' },
      { tipo: 'oficio', cuando: 'dia_siguiente', fundamento: 'CFPC, art. 321' },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'CFPC, art. 321',
      },
      {
        tipo: 'edictos',
        cuando: 'dia_siguiente',
        fundamento: 'CFPC, art. 321',
        nota: 'Cuenta desde la última publicación.',
      },
    ],
    advertencias: [],
    verificacion: 'semilla_no_verificada',
  },

  civil_familiar_local: {
    id: 'civil_familiar_local',
    nombre: 'Civil y familiar local',
    ordenamiento:
      'Código Nacional de Procedimientos Civiles y Familiares / código procesal de la entidad',
    descripcion:
      'Materia civil, familiar y sucesoria del fuero común. Régimen en transición.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Verifica si en la entidad y en la fecha del asunto rige ya el Código Nacional de Procedimientos Civiles y Familiares o todavía el código local.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'Regla general; confirma contra el ordenamiento aplicable',
      },
      {
        tipo: 'lista',
        cuando: 'dia_siguiente',
        fundamento: 'Regla general; confirma contra el ordenamiento aplicable',
      },
      {
        tipo: 'oficio',
        cuando: 'dia_siguiente',
        fundamento: 'Regla general; confirma contra el ordenamiento aplicable',
      },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'Regla general; confirma contra el ordenamiento aplicable',
      },
      {
        tipo: 'edictos',
        cuando: 'dia_siguiente',
        fundamento: 'Regla general; confirma contra el ordenamiento aplicable',
      },
    ],
    advertencias: [
      'Régimen en transición: el Código Nacional de Procedimientos Civiles y Familiares (DOF 07/06/2023) entra en vigor de forma escalonada por entidad, con límite el 1 de abril de 2027. Confirma cuál ordenamiento rige en esta entidad para la fecha de inicio de este asunto antes de confiar en el cómputo.',
    ],
    verificacion: 'semilla_no_verificada',
  },

  amparo: {
    id: 'amparo',
    nombre: 'Amparo',
    ordenamiento: 'Ley de Amparo',
    descripcion:
      'Amparo indirecto y directo, y sus recursos. Único régimen del catálogo donde hay notificaciones que surten efectos el mismo día.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Ley de Amparo, art. 22. El surtimiento de efectos se rige por el art. 31, que distingue según a quién se notifica.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'Ley de Amparo, art. 31',
        nota: 'Para autoridades responsables y terceros interesados la notificación puede surtir efectos desde el momento en que queda legalmente hecha. Confirma en calidad de quién se te notificó.',
      },
      {
        tipo: 'oficio',
        cuando: 'mismo_dia',
        fundamento: 'Ley de Amparo, art. 31',
        nota: 'Regla aplicable a autoridades responsables. Si tu parte es la quejosa, la regla suele ser la del día siguiente.',
      },
      {
        tipo: 'lista',
        cuando: 'dia_siguiente',
        fundamento: 'Ley de Amparo, art. 31',
      },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'Ley de Amparo, art. 31',
        nota: 'En el expediente electrónico revisa la regla de tenerse por notificado al abrir el archivo o al vencer el plazo para abrirlo.',
      },
      {
        tipo: 'edictos',
        cuando: 'dia_siguiente',
        fundamento: 'Ley de Amparo, art. 31',
      },
    ],
    advertencias: [
      'En amparo el surtimiento depende del carácter con el que se te notifica. Verifica si actúas como quejoso, autoridad responsable o tercero interesado antes de dar el cómputo por bueno.',
      'Hay supuestos en que la demanda de amparo puede promoverse en cualquier tiempo (entre otros, actos que importan peligro de privación de la vida o ataques a la libertad personal). En esos casos no computes un plazo: márcalo como sin plazo.',
    ],
    verificacion: 'semilla_no_verificada',
  },

  laboral: {
    id: 'laboral',
    nombre: 'Laboral',
    ordenamiento: 'Ley Federal del Trabajo',
    descripcion:
      'Procedimiento ante los Tribunales Laborales tras la reforma de 2019, y conciliación prejudicial ante los Centros de Conciliación.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Ley Federal del Trabajo, art. 733.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'LFT, art. 733',
      },
      { tipo: 'lista', cuando: 'dia_siguiente', fundamento: 'LFT, art. 733' },
      { tipo: 'oficio', cuando: 'dia_siguiente', fundamento: 'LFT, art. 733' },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'LFT, art. 733',
      },
      { tipo: 'edictos', cuando: 'dia_siguiente', fundamento: 'LFT, art. 733' },
    ],
    advertencias: [
      'En materia laboral el calendario de inhábiles no coincide con el judicial general: revisa los días de descanso obligatorio del art. 74 de la LFT y los que suspenda el propio Tribunal o Centro de Conciliación.',
    ],
    verificacion: 'semilla_no_verificada',
  },

  contencioso_administrativo: {
    id: 'contencioso_administrativo',
    nombre: 'Contencioso administrativo federal',
    ordenamiento: 'Ley Federal de Procedimiento Contencioso Administrativo',
    descripcion:
      'Juicio de nulidad ante el Tribunal Federal de Justicia Administrativa, en sus vías ordinaria, sumaria y en línea.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Ley Federal de Procedimiento Contencioso Administrativo.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'LFPCA, reglas de notificación',
      },
      {
        tipo: 'lista',
        cuando: 'dia_siguiente',
        fundamento: 'LFPCA, reglas de notificación',
      },
      {
        tipo: 'oficio',
        cuando: 'dia_siguiente',
        fundamento: 'LFPCA, reglas de notificación',
      },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'LFPCA, juicio en línea',
        nota: 'En el Juicio en Línea la notificación puede tenerse por hecha al abrir el archivo o al tercer día hábil de su envío si no se abre. Ese matiz cambia todo el cómputo: confírmalo.',
      },
      {
        tipo: 'edictos',
        cuando: 'dia_siguiente',
        fundamento: 'LFPCA, reglas de notificación',
      },
    ],
    advertencias: [
      'La vía sumaria tiene plazos propios y más cortos que la ordinaria. Confirma en qué vía se admitió antes de computar.',
    ],
    verificacion: 'semilla_no_verificada',
  },

  fiscal_administrativo: {
    id: 'fiscal_administrativo',
    nombre: 'Fiscal — recursos administrativos',
    ordenamiento: 'Código Fiscal de la Federación',
    descripcion:
      'Recurso de revocación y demás plazos del procedimiento administrativo ante el SAT y otras autoridades fiscales.',
    unidadPorDefecto: 'habiles',
    incluyeDiaVencimiento: true,
    fundamentoComputo: `${ARRANQUE_DIA_SIGUIENTE} Código Fiscal de la Federación, art. 12 para el cómputo y art. 135 para el surtimiento de efectos de las notificaciones.`,
    reglas: [
      {
        tipo: 'personal',
        cuando: 'dia_siguiente',
        fundamento: 'CFF, art. 135',
      },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'CFF, art. 17-K y 134, fr. I (buzón tributario)',
        nota: 'En buzón tributario el acto se tiene por notificado al abrir el acuse o al cuarto día hábil siguiente al envío del aviso si no se abre. Captura la fecha que corresponda, no la del envío.',
      },
      { tipo: 'oficio', cuando: 'dia_siguiente', fundamento: 'CFF, art. 135' },
      { tipo: 'lista', cuando: 'dia_siguiente', fundamento: 'CFF, art. 139' },
      { tipo: 'edictos', cuando: 'dia_siguiente', fundamento: 'CFF, art. 140' },
    ],
    advertencias: [
      'El calendario de inhábiles fiscal es propio: además de los feriados, cuenta los periodos generales de vacaciones de la autoridad. No reutilices el calendario judicial.',
    ],
    verificacion: 'semilla_no_verificada',
  },

  penal_acusatorio: {
    id: 'penal_acusatorio',
    nombre: 'Penal acusatorio',
    ordenamiento: 'Código Nacional de Procedimientos Penales',
    descripcion:
      'Sistema penal acusatorio: carpeta de investigación, etapa inicial, intermedia y juicio oral.',
    unidadPorDefecto: 'naturales',
    incluyeDiaVencimiento: true,
    fundamentoComputo:
      'En el sistema acusatorio buena parte de los plazos se cuentan en días naturales y varios corren en horas. Código Nacional de Procedimientos Penales, arts. 94 y 95.',
    reglas: [
      {
        tipo: 'personal',
        cuando: 'mismo_dia',
        fundamento: 'CNPP, reglas de notificación',
        nota: 'En audiencia, las resoluciones se tienen por notificadas a los presentes en ese acto.',
      },
      {
        tipo: 'lista',
        cuando: 'dia_siguiente',
        fundamento: 'CNPP, reglas de notificación',
      },
      {
        tipo: 'oficio',
        cuando: 'dia_siguiente',
        fundamento: 'CNPP, reglas de notificación',
      },
      {
        tipo: 'electronica',
        cuando: 'dia_siguiente',
        fundamento: 'CNPP, reglas de notificación',
      },
      {
        tipo: 'edictos',
        cuando: 'dia_siguiente',
        fundamento: 'CNPP, reglas de notificación',
      },
    ],
    advertencias: [
      'Este régimen es el peor candidato para un cómputo automático: hay plazos en horas (control de detención, plazo constitucional) que esta herramienta no calcula. Úsala solo para los plazos en días y verifica siempre.',
      'Los plazos en días naturales corren aunque el día sea inhábil. No apliques aquí el calendario judicial sin confirmarlo.',
    ],
    verificacion: 'semilla_no_verificada',
  },
}

export const LISTA_REGIMENES: readonly RegimenProcesal[] =
  Object.values(REGIMENES)

/** La regla de surtimiento aplicable, o `null` si el régimen no la contempla. */
export function reglaDeSurtimiento(
  regimen: IdRegimen,
  tipo: TipoNotificacion,
): ReglaSurtimiento | null {
  return REGIMENES[regimen].reglas.find((r) => r.tipo === tipo) ?? null
}

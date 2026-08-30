/**
 * Etapas procesales por vía — el tablero real de un litigio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ NO HAY UN FLUJO ÚNICO DE N FASES
 * ─────────────────────────────────────────────────────────────────────────────
 * Un tablero fijo obliga a que todos los asuntos finjan seguir el mismo camino,
 * y ninguno lo sigue. En el ejecutivo mercantil se embarga ANTES de emplazar.
 * En el amparo indirecto corre un incidente de suspensión en paralelo al
 * cuaderno principal, con su propia audiencia. Un juicio sucesorio tiene cuatro
 * secciones y no una secuencia. En laboral hay una conciliación prejudicial
 * obligatoria sin la cual no existe juicio.
 *
 * Forzar eso a "Análisis → Elaboración → Entrega" produce un tablero donde
 * todos los asuntos están en la misma columna y nadie sabe qué sigue, que es
 * exactamente el problema que la herramienta viene a resolver.
 *
 * Por eso las etapas son PLANTILLAS por vía: el despacho las clona al abrir el
 * expediente y a partir de ahí son suyas. Puede renombrarlas, agregar o quitar,
 * sin que se rompa nada, porque el expediente guarda su propia copia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * `paralela` — LA COLUMNA QUE NO ES UNA COLUMNA
 * ─────────────────────────────────────────────────────────────────────────────
 * Algunas etapas no van después de otra: corren al mismo tiempo. La suspensión
 * en amparo es el caso claro. Marcarlas como paralelas evita el absurdo de
 * "mover" el expediente a suspensión y perder de vista el principal.
 */

export interface EtapaPlantilla {
  /** Único dentro de la vía. */
  id: string
  nombre: string
  /** Qué pasa aquí, en una línea, para quien no lleva ese tipo de asunto a diario. */
  descripcion: string
  /** Corre en paralelo al hilo principal en vez de después de la anterior. */
  paralela?: boolean
  /** Lo que típicamente hay que hacer o vigilar en esta etapa. */
  pendientesSugeridos?: readonly string[]
}

export interface PlantillaEtapas {
  via: string
  etapas: readonly EtapaPlantilla[]
}

function e(
  id: string,
  nombre: string,
  descripcion: string,
  extra: Omit<EtapaPlantilla, 'id' | 'nombre' | 'descripcion'> = {},
): EtapaPlantilla {
  return { id, nombre, descripcion, ...extra }
}

const ORDINARIO_MERCANTIL: readonly EtapaPlantilla[] = [
  e('preparacion', 'Preparación', 'Integración de documentos base y poder.', {
    pendientesSugeridos: [
      'Confirmar personalidad y vigencia del poder',
      'Reunir documentos fundatorios de la acción',
      'Revisar prescripción de la acción',
    ],
  }),
  e('demanda', 'Demanda presentada', 'Escrito inicial en oficialía de partes.', {
    pendientesSugeridos: ['Guardar el acuse sellado'],
  }),
  e('admision', 'Admisión y emplazamiento', 'Auto admisorio y diligencia de emplazamiento.', {
    pendientesSugeridos: [
      'Vigilar que se practique el emplazamiento',
      'Revisar el acta del actuario',
    ],
  }),
  e('contestacion', 'Contestación o rebeldía', 'Plazo de la contraparte para contestar.', {
    pendientesSugeridos: ['Computar el plazo de contestación', 'Acusar rebeldía si procede'],
  }),
  e('audiencia_previa', 'Audiencia previa y de conciliación', 'Depuración y conciliación.'),
  e('pruebas_ofrecimiento', 'Ofrecimiento y admisión de pruebas', 'Ofrecimiento y auto que las admite.'),
  e('pruebas_desahogo', 'Desahogo de pruebas', 'Periciales, testimoniales, inspecciones.', {
    pendientesSugeridos: ['Agendar cada desahogo', 'Vigilar preparación de peritos y testigos'],
  }),
  e('alegatos', 'Alegatos', 'Alegatos de las partes.'),
  e('citacion_sentencia', 'Citación para sentencia', 'Cerrada la instrucción.'),
  e('sentencia', 'Sentencia de primera instancia', 'Resolución del juzgado.', {
    pendientesSugeridos: ['Computar el plazo de apelación en cuanto se notifique'],
  }),
  e('apelacion', 'Apelación', 'Segunda instancia ante la Sala.'),
  e('ejecucion', 'Ejecución', 'Cumplimiento forzoso de la sentencia.'),
]

const EJECUTIVO_MERCANTIL: readonly EtapaPlantilla[] = [
  e('preparacion', 'Preparación', 'Revisión del título ejecutivo.', {
    pendientesSugeridos: [
      'Verificar que el título traiga aparejada ejecución',
      'Revisar prescripción del título',
    ],
  }),
  e('demanda', 'Demanda presentada', 'Escrito inicial con el título.'),
  e('auto_exequendo', 'Auto de exequendo', 'Auto que ordena requerir, embargar y emplazar.'),
  e(
    'requerimiento_embargo',
    'Requerimiento y embargo',
    'Diligencia: se requiere de pago, se embarga y hasta entonces se emplaza. Este orden es lo que distingue al ejecutivo del ordinario.',
    {
      pendientesSugeridos: [
        'Señalar bienes para embargo',
        'Acompañar al actuario en la diligencia',
        'Inscribir el embargo si el bien lo requiere',
      ],
    },
  ),
  e('contestacion', 'Contestación y excepciones', 'Oposición de excepciones por el demandado.'),
  e('pruebas', 'Pruebas', 'Ofrecimiento y desahogo.'),
  e('alegatos', 'Alegatos', 'Alegatos de las partes.'),
  e('sentencia', 'Sentencia', 'Resolución de primera instancia.'),
  e('remate', 'Remate y adjudicación', 'Avalúo, convocatoria y almoneda.'),
]

const AMPARO_INDIRECTO: readonly EtapaPlantilla[] = [
  e('preparacion', 'Preparación de demanda', 'Identificación del acto reclamado y autoridades.', {
    pendientesSugeridos: [
      'Precisar acto reclamado y autoridades ordenadora y ejecutora',
      'Computar el plazo del art. 17 desde la notificación o conocimiento del acto',
      'Definir si procede pedir suspensión',
    ],
  }),
  e('demanda', 'Demanda presentada', 'Presentación ante el Juzgado de Distrito.'),
  e('admision', 'Admisión, prevención o desechamiento', 'Auto inicial del Juzgado.', {
    pendientesSugeridos: ['Si hay prevención, computar el plazo para desahogarla'],
  }),
  e(
    'suspension_provisional',
    'Suspensión provisional',
    'Se resuelve en el mismo auto inicial. Corre en cuaderno incidental aparte.',
    {
      paralela: true,
      pendientesSugeridos: ['Cumplir requisitos de efectividad si se fijó garantía'],
    },
  ),
  e(
    'suspension_definitiva',
    'Incidente de suspensión',
    'Audiencia incidental y resolución sobre suspensión definitiva. Va en paralelo al principal.',
    { paralela: true },
  ),
  e('informes', 'Informes justificados', 'Rendición de informes por las autoridades responsables.', {
    pendientesSugeridos: ['Vigilar que se rindan', 'Ampliar demanda si aparecen actos nuevos'],
  }),
  e('audiencia_constitucional', 'Audiencia constitucional', 'Pruebas, alegatos y cierre.'),
  e('sentencia', 'Sentencia', 'Resolución del Juzgado de Distrito.', {
    pendientesSugeridos: ['Computar el plazo de revisión en cuanto se notifique'],
  }),
  e('revision', 'Recurso de revisión', 'Ante Tribunal Colegiado.'),
  e('cumplimiento', 'Cumplimiento', 'Ejecución de la sentencia de amparo.'),
]

const LABORAL_ORDINARIO: readonly EtapaPlantilla[] = [
  e(
    'conciliacion_prejudicial',
    'Conciliación prejudicial',
    'Etapa obligatoria ante el Centro de Conciliación. Sin la constancia de no conciliación no se admite la demanda.',
    {
      pendientesSugeridos: [
        'Presentar solicitud de conciliación',
        'Asistir a la audiencia',
        'Obtener constancia de no conciliación',
      ],
    },
  ),
  e('demanda', 'Demanda ante Tribunal Laboral', 'Escrito inicial acompañando la constancia.'),
  e('admision', 'Admisión y emplazamiento', 'Auto admisorio y notificación al demandado.'),
  e('contestacion', 'Contestación', 'Contestación del demandado.'),
  e('audiencia_preliminar', 'Audiencia preliminar', 'Depuración, fijación de litis y admisión de pruebas.'),
  e('audiencia_juicio', 'Audiencia de juicio', 'Desahogo de pruebas y alegatos.'),
  e('sentencia', 'Sentencia', 'Resolución del Tribunal Laboral.'),
  e('amparo_directo', 'Amparo directo', 'Impugnación del laudo o sentencia.'),
  e('ejecucion', 'Ejecución', 'Cumplimiento de la condena.'),
]

const NULIDAD_TFJA: readonly EtapaPlantilla[] = [
  e('preparacion', 'Preparación', 'Análisis de la resolución impugnada.', {
    pendientesSugeridos: [
      'Determinar si procede vía ordinaria o sumaria — el plazo cambia',
      'Computar el plazo desde el surtimiento de la notificación',
    ],
  }),
  e('demanda', 'Demanda de nulidad', 'Presentación ante el TFJA.'),
  e('admision', 'Admisión', 'Auto admisorio.'),
  e('contestacion', 'Contestación de la autoridad', 'Contestación de la demandada.'),
  e('ampliacion', 'Ampliación de demanda', 'Cuando procede, con plazo propio.', { paralela: true }),
  e('alegatos', 'Alegatos', 'Alegatos de las partes.'),
  e('cierre', 'Cierre de instrucción', 'Cerrada la instrucción.'),
  e('sentencia', 'Sentencia', 'Resolución de la Sala.'),
  e('impugnacion', 'Revisión fiscal o amparo directo', 'Medios de impugnación contra la sentencia.'),
]

const SUCESORIO: readonly EtapaPlantilla[] = [
  e('preparacion', 'Preparación', 'Acta de defunción, testamento y documentos de los bienes.'),
  e('denuncia', 'Denuncia o solicitud', 'Inicio del juicio sucesorio.'),
  e('seccion_primera', 'Primera sección — sucesión', 'Reconocimiento de herederos y albacea.'),
  e('seccion_segunda', 'Segunda sección — inventarios', 'Inventario y avalúo.', { paralela: true }),
  e('seccion_tercera', 'Tercera sección — administración', 'Cuentas del albacea.', { paralela: true }),
  e('seccion_cuarta', 'Cuarta sección — partición', 'Proyecto de partición y adjudicación.', {
    paralela: true,
  }),
  e('adjudicacion', 'Adjudicación', 'Escrituración y entrega de bienes.'),
]

const CONSULTIVO: readonly EtapaPlantilla[] = [
  e('solicitud', 'Solicitud del cliente', 'Qué necesita y para cuándo.'),
  e('informacion', 'Recopilación de información', 'Documentos y datos necesarios.'),
  e('elaboracion', 'Elaboración', 'Redacción del instrumento u opinión.'),
  e('revision', 'Revisión interna', 'Revisión por el responsable del asunto.'),
  e('entrega', 'Entrega al cliente', 'Envío y explicación.'),
  e('formalizacion', 'Formalización', 'Firma, protocolización o inscripción cuando aplique.'),
]

/** Plantilla por vía. Si una vía no está aquí, se usa `ETAPAS_GENERICAS`. */
export const PLANTILLAS: Record<string, readonly EtapaPlantilla[]> = {
  'merc.ordinario': ORDINARIO_MERCANTIL,
  'merc.oral': ORDINARIO_MERCANTIL,
  'merc.ejecutivo': EJECUTIVO_MERCANTIL,
  'merc.oral_ejecutivo': EJECUTIVO_MERCANTIL,
  'civ.ordinario': ORDINARIO_MERCANTIL,
  'civ.especial_hipotecario': EJECUTIVO_MERCANTIL,
  'civ.sucesorio': SUCESORIO,
  'fam.controversia': ORDINARIO_MERCANTIL,
  'fam.divorcio': ORDINARIO_MERCANTIL,
  'lab.ordinario': LABORAL_ORDINARIO,
  'lab.conciliacion': LABORAL_ORDINARIO,
  'amp.indirecto': AMPARO_INDIRECTO,
  'amp.directo': AMPARO_INDIRECTO,
  'adm.nulidad_ordinaria': NULIDAD_TFJA,
  'adm.nulidad_sumaria': NULIDAD_TFJA,
  'fis.revocacion': NULIDAD_TFJA,
  'corp.asunto': CONSULTIVO,
}

/**
 * Último recurso cuando la vía no tiene plantilla. Deliberadamente pobre: es
 * mejor que el despacho note que le falta la plantilla y la arme, a que un
 * flujo genérico le dé la impresión de que el asunto está bien seguido.
 */
export const ETAPAS_GENERICAS: readonly EtapaPlantilla[] = [
  e('preparacion', 'Preparación', 'Integración del expediente.'),
  e('tramite', 'En trámite', 'Etapa de sustanciación.'),
  e('resolucion', 'Resolución', 'Resolución del órgano.'),
  e('concluido', 'Concluido', 'Asunto terminado.'),
]

export function etapasDeVia(idVia: string): readonly EtapaPlantilla[] {
  return PLANTILLAS[idVia] ?? ETAPAS_GENERICAS
}

/** ¿La vía tiene plantilla propia o va a caer en la genérica? */
export function tienePlantillaPropia(idVia: string): boolean {
  return idVia in PLANTILLAS
}

/**
 * Las etapas del hilo principal, en orden. Las paralelas se excluyen porque no
 * son posiciones del avance: un expediente no "está en" suspensión, la tiene.
 */
export function etapasPrincipales(idVia: string): readonly EtapaPlantilla[] {
  return etapasDeVia(idVia).filter((etapa) => !etapa.paralela)
}

/** 0 a 1. Sirve para la barra de avance del portal del cliente. */
export function avance(idVia: string, idEtapaActual: string): number {
  const principales = etapasPrincipales(idVia)
  const indice = principales.findIndex((etapa) => etapa.id === idEtapaActual)
  if (indice < 0 || principales.length === 0) return 0
  return (indice + 1) / principales.length
}

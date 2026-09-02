/**
 * Qué datos toca el sistema, para qué, y quién más los ve.
 *
 * Va como dato y no como párrafo dentro de la página por una razón práctica:
 * este inventario tiene que seguirle el paso al esquema. Cuando una migración
 * agregue una columna con datos de una persona, o entre un proveedor nuevo, se
 * edita aquí y el aviso de privacidad se actualiza solo. Un aviso que describe
 * un sistema que ya cambió es peor que no tenerlo, porque afirma cosas falsas
 * con cara de documento formal.
 *
 * Espejo de las migraciones `0001`–`0012`.
 */

export interface GrupoDeDatos {
  quien: string
  datos: string
  paraQue: string
  /** De dónde salen en el esquema, para poder cotejarlo contra la base. */
  donde: string
}

export const DATOS_QUE_SE_TRATAN: readonly GrupoDeDatos[] = [
  {
    quien: 'Quien crea una cuenta',
    datos:
      'Nombre, correo electrónico y, si los captura, teléfono y cédula profesional. La contraseña no se guarda: la administra el proveedor de autenticación y viaja cifrada.',
    paraQue:
      'Dar acceso a la cuenta, identificar quién hizo cada movimiento en la bitácora y mandar las alertas de vencimiento.',
    donde: 'perfiles',
  },
  {
    quien: 'El despacho',
    datos:
      'Nombre, teléfono y los datos de su suscripción: plan, asientos contratados y los identificadores del cobro.',
    paraQue: 'Operar la cuenta y cobrar la suscripción.',
    donde: 'despachos',
  },
  {
    quien: 'Las personas del padrón del despacho',
    datos:
      'Nombre, tipo de persona, RFC, CURP, correo, teléfono, domicilio, representante y la relación con el asunto (cliente, contraparte, tercero).',
    paraQue:
      'Llevar los expedientes y cotejar conflicto de interés antes de aceptar un asunto nuevo.',
    donde: 'personas',
  },
  {
    quien: 'Los asuntos del despacho',
    datos:
      'Carátula, número de expediente, materia, vía, órgano, cuantía, etapas, actuaciones de la bitácora, plazos, audiencias y los documentos que se suban.',
    paraQue:
      'Computar los plazos, avisar antes de que venzan y llevar el historial del asunto.',
    donde: 'expedientes, actuaciones, plazos, audiencias, documentos',
  },
]

export interface Encargado {
  nombre: string
  paraQue: string
  /** Dónde se procesa. Importa: sale del país. */
  donde: string
}

/**
 * Quién más toca los datos.
 *
 * Son **encargados**, no destinatarios de una transferencia: procesan por
 * cuenta de Litis y no pueden usar los datos para lo suyo. Se listan de todos
 * modos, con nombre, porque "podemos compartir datos con proveedores" no le
 * dice nada a nadie.
 */
export const ENCARGADOS: readonly Encargado[] = [
  {
    nombre: 'Supabase',
    paraQue:
      'Base de datos, autenticación y almacenamiento de los documentos que suba el despacho.',
    donde: 'Estados Unidos',
  },
  {
    nombre: 'Stripe',
    paraQue:
      'Cobro de la suscripción. Los datos de la tarjeta se capturan en Stripe y nunca pasan por los servidores de Litis.',
    donde: 'Estados Unidos',
  },
  {
    nombre: 'Resend',
    paraQue:
      'Envío de los correos del sistema: alertas de vencimiento e invitaciones al despacho.',
    donde: 'Estados Unidos',
  },
]

/**
 * Lo que el sistema **no** hace. Se dice porque hoy es verificable, y porque
 * el día que deje de serlo habrá que venir a borrarlo de aquí — que es
 * exactamente la fricción que se busca.
 */
export const LO_QUE_NO_SE_HACE: readonly string[] = [
  'No se venden ni se rentan datos a nadie.',
  'No se usa el contenido de los expedientes para entrenar modelos de inteligencia artificial.',
  'No hay publicidad, ni perfilamiento con fines comerciales.',
  'No hay rastreadores de terceros ni herramientas de analítica en el sitio: las únicas cookies son las de la sesión, y sin ellas no se puede mantener a alguien dentro de su cuenta.',
]

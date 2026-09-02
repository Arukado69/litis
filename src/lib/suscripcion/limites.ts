import type { EstadoSuscripcion, PlanSuscripcion } from '@/types/db'

/**
 * Los topes del plan, como reglas del dominio.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA REGLA QUE MANDA SOBRE TODAS LAS DEMÁS
 * ─────────────────────────────────────────────────────────────────────────────
 * El tope solo puede frenar **dos** cosas: abrir un expediente y sumar un
 * asiento. Nada más.
 *
 * Cerrar un plazo, asentar una actuación, subir un documento, computar un
 * vencimiento, recibir las alertas por correo y leer todo lo ya capturado
 * funcionan igual con la suscripción morosa, vencida o cancelada. Un cobro que
 * impide registrar que se presentó en tiempo convierte un problema de tarjeta
 * en un término perdido, y del término responde el abogado ante su cliente y
 * ante su barra. Es el único error que este producto no se puede permitir.
 *
 * `ACCIONES_TOPADAS` está escrita como lista cerrada y con prueba: agregar una
 * acción a esa lista tiene que ser una decisión deliberada, no un descuido.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ MANDA: LA FILA, NO ESTA TABLA
 * ─────────────────────────────────────────────────────────────────────────────
 * Los topes que se aplican son los de la fila del despacho
 * (`asientos_incluidos`, `expedientes_tope`), que es exactamente lo que miran
 * los disparadores de la `0012`. Si el motor usara su propia tabla, la
 * aplicación y la base podrían decir cosas distintas sobre el mismo despacho —
 * y la que gana siempre es la base, así que la aplicación estaría mintiendo.
 *
 * `TOPES_POR_PLAN` existe para lo otro: es lo que el webhook **escribe** en la
 * fila cuando el plan cambia, y de donde salen los números de la portada.
 */

export interface Topes {
  /** Asientos de personal. Los clientes del portal no cuentan. */
  asientos: number
  /** Expedientes que no están concluidos ni archivados. `null` = sin tope. */
  expedientesActivos: number | null
}

export const TOPES_POR_PLAN: Record<PlanSuscripcion, Topes> = {
  gratuito: { asientos: 1, expedientesActivos: 10 },
  /**
   * En el plan de paga los asientos son los que se compran: el número real lo
   * escribe el webhook con la cantidad de la suscripción. Este 1 es solo el
   * arranque de una suscripción que todavía no ha confirmado su cantidad.
   */
  despacho: { asientos: 1, expedientesActivos: null },
  /**
   * `profesional` viene del enum de la `0001` y hoy no se vende: no hay un
   * nivel intermedio. Se le dan los topes del de paga porque la única forma de
   * que una fila lo tenga es a través del cobro —las columnas de plan están
   * blindadas a la clave de servicio desde la `0012`—, así que si aparece, es
   * alguien que pagó. El día que se venda, sus topes se deciden aquí.
   */
  profesional: { asientos: 1, expedientesActivos: null },
}

export const PLAN_ETIQUETA: Record<PlanSuscripcion, string> = {
  gratuito: 'Litigante solo',
  profesional: 'Profesional',
  despacho: 'Despacho',
}

export const ESTADO_ETIQUETA: Record<EstadoSuscripcion, string> = {
  gratuita: 'Plan gratuito',
  activa: 'Al corriente',
  morosa: 'Cobro pendiente',
  cancelada: 'Cancelada',
}

/** La fila del despacho, en lo que toca al cobro. */
export interface Suscripcion {
  plan: PlanSuscripcion
  estado: EstadoSuscripcion
  /** `asientos_incluidos`: los que se pagan. */
  asientos: number
  /** `expedientes_tope`: `null` = sin tope. */
  expedientesTope: number | null
  /** Hasta cuándo está pagado el periodo en curso (ISO), si hay suscripción. */
  periodoFin: string | null
  /** Pidió cancelar y sigue vigente hasta el fin del periodo. */
  cancelaAlFin: boolean
  tieneCliente: boolean
}

/** Lo que el despacho está usando ahora mismo. */
export interface Consumo {
  /** Membresías activas que no son del portal del cliente. */
  asientosOcupados: number
  /**
   * Invitaciones vigentes sin aceptar. **Cuentan como asiento.** Si no
   * contaran, se mandan veinte invitaciones con un asiento pagado y el tope se
   * cae solo cuando ya están todos adentro — que es el peor momento para
   * enterarse.
   */
  invitacionesPendientes: number
  /** Expedientes que no están concluidos ni archivados. */
  expedientesActivos: number
}

// ── Qué se topa y qué no ────────────────────────────────────────────────────

/** Todo lo que el despacho hace en el sistema, para poder decir qué se topa. */
export type AccionDelDespacho =
  | 'abrir_expediente'
  | 'sumar_asiento'
  | 'computar_plazo'
  | 'cerrar_plazo'
  | 'asentar_actuacion'
  | 'subir_documento'
  | 'agendar_audiencia'
  | 'mover_etapa'
  | 'verificar_catalogo'
  | 'dar_acceso_al_cliente'
  | 'recibir_alertas'
  | 'leer_expediente'

/** Las únicas dos. Ver el encabezado del archivo. */
export const ACCIONES_TOPADAS: readonly AccionDelDespacho[] = [
  'abrir_expediente',
  'sumar_asiento',
]

export function topeAplicaA(accion: AccionDelDespacho): boolean {
  return ACCIONES_TOPADAS.includes(accion)
}

/**
 * Cómo se llama cada acción en pantalla.
 *
 * La pantalla de suscripción arma con esto la lista de lo que el tope **no**
 * frena, en vez de repetirla a mano en el JSX. Así la promesa que se lee en la
 * pantalla y la lista que fija la prueba son el mismo dato: si algún día una
 * acción se vuelve topada, la pantalla deja de prometerla sola.
 */
export const ACCION_ETIQUETA: Record<AccionDelDespacho, string> = {
  abrir_expediente: 'Abrir un expediente',
  sumar_asiento: 'Sumar a alguien al equipo',
  computar_plazo: 'Computar un plazo, con su traza',
  cerrar_plazo: 'Cerrar un plazo: presentado, o ya no aplica',
  asentar_actuacion: 'Asentar en la bitácora',
  subir_documento: 'Subir documentos al expediente',
  agendar_audiencia: 'Agendar, diferir y celebrar audiencias',
  mover_etapa: 'Mover la etapa del asunto',
  verificar_catalogo: 'Verificar y corregir el catálogo de plazos',
  dar_acceso_al_cliente: 'Darle acceso al cliente a su portal',
  recibir_alertas: 'Recibir las alertas por correo',
  leer_expediente: 'Leer todo lo ya capturado',
}

/** Todo lo que sigue funcionando aunque el plan esté al tope o sin pagar. */
export const ACCIONES_LIBRES: readonly AccionDelDespacho[] = (
  Object.keys(ACCION_ETIQUETA) as AccionDelDespacho[]
).filter((a) => !topeAplicaA(a))

// ── Cupo ────────────────────────────────────────────────────────────────────

export type Veredicto =
  | { permitido: true; restantes: number | null; aviso: string | null }
  | { permitido: false; motivo: string; salida: string }

/** Asientos ya comprometidos: gente adentro más invitaciones sin contestar. */
export function asientosComprometidos(consumo: Consumo): number {
  return consumo.asientosOcupados + consumo.invitacionesPendientes
}

/** Cuántos asientos quedan. Negativo si el despacho quedó por encima. */
export function asientosLibres(s: Suscripcion, consumo: Consumo): number {
  return s.asientos - asientosComprometidos(consumo)
}

/** Cuántos expedientes más caben. `null` = sin tope. */
export function expedientesLibres(
  s: Suscripcion,
  consumo: Consumo,
): number | null {
  if (s.expedientesTope === null) return null
  return s.expedientesTope - consumo.expedientesActivos
}

function plural(n: number, uno: string, varios: string): string {
  return n === 1 ? `1 ${uno}` : `${n} ${varios}`
}

export function puedeAbrirExpediente(
  s: Suscripcion,
  consumo: Consumo,
): Veredicto {
  const libres = expedientesLibres(s, consumo)
  if (libres === null) return { permitido: true, restantes: null, aviso: null }

  if (libres <= 0) {
    return {
      permitido: false,
      motivo: `Tu plan llega a ${plural(s.expedientesTope ?? 0, 'expediente activo', 'expedientes activos')} y ya tienes ${consumo.expedientesActivos}.`,
      salida:
        'Concluye o archiva un asunto —lo cerrado no ocupa lugar y no se borra nada— o pasa al plan de paga.',
    }
  }

  return {
    permitido: true,
    restantes: libres,
    // El aviso aparece cuando ya se ve el fondo, no desde el primer expediente.
    aviso:
      libres <= 3
        ? `Te ${libres === 1 ? 'queda 1 expediente' : `quedan ${libres} expedientes`} en tu plan.`
        : null,
  }
}

export function puedeSumarAsiento(s: Suscripcion, consumo: Consumo): Veredicto {
  const libres = asientosLibres(s, consumo)

  if (libres <= 0) {
    const pendientes = consumo.invitacionesPendientes
    return {
      permitido: false,
      motivo:
        pendientes > 0
          ? `Tu plan tiene ${plural(s.asientos, 'asiento', 'asientos')} y ya están comprometidos: ${plural(consumo.asientosOcupados, 'persona adentro', 'personas adentro')} y ${plural(pendientes, 'invitación sin contestar', 'invitaciones sin contestar')}.`
          : `Tu plan tiene ${plural(s.asientos, 'asiento', 'asientos')} y ya ${s.asientos === 1 ? 'está ocupado' : 'están ocupados'}.`,
      salida:
        pendientes > 0
          ? 'Revoca una invitación pendiente, da de baja a alguien, o suma asientos a tu suscripción.'
          : 'Suma asientos a tu suscripción, o da de baja a alguien del equipo.',
    }
  }

  return {
    permitido: true,
    restantes: libres,
    aviso: libres === 1 ? 'Es el último asiento de tu plan.' : null,
  }
}

// ── Quedarse por encima del tope ────────────────────────────────────────────

export interface Excedido {
  asientos: number
  expedientes: number
}

/**
 * Por cuánto se pasó el despacho.
 *
 * Pasa cuando alguien cancela: se queda con cuarenta expedientes y cuatro
 * personas en un plan que da diez y una. **No se suspende a nadie ni se esconde
 * nada** — se pierde la capacidad de crecer, no lo que ya existe. Sale más caro
 * cobrar de menos un mes que dejar a un pasante fuera de un expediente que
 * vence mañana.
 */
export function excedido(s: Suscripcion, consumo: Consumo): Excedido | null {
  const asientos = Math.max(0, asientosComprometidos(consumo) - s.asientos)
  const libres = expedientesLibres(s, consumo)
  const expedientes = libres === null ? 0 : Math.max(0, -libres)

  if (asientos === 0 && expedientes === 0) return null
  return { asientos, expedientes }
}

export function avisoDeExcedido(e: Excedido): string {
  const partes: string[] = []
  if (e.expedientes > 0) {
    partes.push(
      `${plural(e.expedientes, 'expediente activo', 'expedientes activos')} por encima del tope`,
    )
  }
  if (e.asientos > 0) {
    partes.push(`${plural(e.asientos, 'asiento', 'asientos')} de más`)
  }
  return `Tu despacho está ${partes.join(' y ')}. No se suspendió a nadie ni se archivó nada: todo sigue como estaba y lo que no puedes es abrir más hasta que vuelvas a tener cupo.`
}

// ── Cuántos asientos comprar ────────────────────────────────────────────────

/**
 * La cantidad con la que se abre el cobro: los que ya están comprometidos, con
 * un mínimo de uno. Proponer menos que la gente que ya trabaja adentro deja al
 * titular pagando por un despacho al que le falta cupo desde el primer día.
 */
export function asientosASugerir(consumo: Consumo): number {
  return Math.max(1, asientosComprometidos(consumo))
}

export const ASIENTOS_MAXIMOS = 100

export function validarAsientos(
  cantidad: number,
  consumo: Consumo,
): string | null {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return 'Pon cuántas personas van a usar Litis. Al menos una.'
  }
  if (cantidad > ASIENTOS_MAXIMOS) {
    return `Son muchos asientos para contratar solos. Escríbenos y lo vemos.`
  }
  const comprometidos = asientosComprometidos(consumo)
  if (cantidad < comprometidos) {
    return `Ya hay ${comprometidos} ${comprometidos === 1 ? 'asiento comprometido' : 'asientos comprometidos'} entre tu equipo y las invitaciones pendientes. Contrata al menos esa cantidad.`
  }
  return null
}

// ── Lo que manda Stripe ─────────────────────────────────────────────────────

/**
 * El `status` de la suscripción de Stripe, traducido.
 *
 * ⚠️ `past_due` y `unpaid` NO cierran el despacho: bajan a "morosa" y la
 * pantalla lo dice, pero los topes siguen siendo los del plan pagado hasta que
 * Stripe cancele de verdad. Cortar el acceso al primer cobro fallido —una
 * tarjeta vencida, un banco que rechazó— es exactamente el escenario en el que
 * alguien pierde un término por un problema administrativo.
 */
export function estadoDesdeStripe(status: string): EstadoSuscripcion {
  switch (status) {
    case 'trialing':
    case 'active':
      return 'activa'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'morosa'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelada'
    default:
      // Un estado que Stripe agregue después no debe apagar nada por sí solo.
      return 'morosa'
  }
}

/** Con qué plan queda el despacho según lo que diga Stripe. */
export function planDesdeStripe(status: string): PlanSuscripcion {
  return estadoDesdeStripe(status) === 'cancelada' ? 'gratuito' : 'despacho'
}

/**
 * Los valores que el webhook escribe en la fila del despacho.
 *
 * Vive aquí, y no en el route handler, porque es la regla —qué topes le tocan a
 * cada plan— y no plomería. Con esto, la prueba puede fijar que cancelar
 * devuelve al gratuito con sus diez expedientes y no deja al despacho sin tope.
 */
export interface CambioDeSuscripcion {
  plan: PlanSuscripcion
  estado: EstadoSuscripcion
  asientos: number
  expedientesTope: number | null
}

export function cambioDesdeStripe(
  status: string,
  cantidad: number,
): CambioDeSuscripcion {
  const plan = planDesdeStripe(status)
  const topes = TOPES_POR_PLAN[plan]
  const asientos =
    plan === 'gratuito' ? topes.asientos : Math.max(1, Math.trunc(cantidad))

  return {
    plan,
    estado: estadoDesdeStripe(status),
    asientos,
    expedientesTope: topes.expedientesActivos,
  }
}

/**
 * Freno anti-fuerza-bruta para las puertas de acceso (motor puro + registro
 * en memoria).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ ESTO NO ES OPCIONAL
 * ─────────────────────────────────────────────────────────────────────────────
 * Una cuenta de despacho ve los expedientes, los datos de los clientes y la
 * estrategia de cada asunto. Sin freno, adivinar una contraseña cuesta un `for`
 * de diez líneas. Y a diferencia de una fuga de datos cualquiera, aquí lo que
 * se pierde es el secreto profesional de un abogado, del que responde él.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DOS DIMENSIONES, NO UNA
 * ─────────────────────────────────────────────────────────────────────────────
 * Se cuenta por (IP + correo) con mano dura y por IP sola con más holgura.
 *
 *   · Solo por correo: un atacante rota IPs y sigue.
 *   · Solo por IP: un despacho detrás de un NAT —todos salen por la misma IP—
 *     se bloquea entre sí cuando dos personas se equivocan la misma mañana.
 *
 * Las dos juntas frenan al que insiste sobre una cuenta y al que barre cuentas,
 * sin castigar a la oficina.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO CUENTAN LOS FALLOS
 * ─────────────────────────────────────────────────────────────────────────────
 * `perdonar()` limpia el contador tras un acceso correcto. Sin eso, quien entra
 * cinco veces en la mañana —cosa normal: teléfono, laptop, otra pestaña— se
 * bloquea a sí mismo.
 *
 * ⚠️ ALCANCE: el registro vive en la memoria del proceso. Alcanza mientras
 * corra UN contenedor. Si algún día hay varias réplicas, esto se muda a Redis o
 * a una tabla; hasta entonces, añadir esa dependencia sería pagar complejidad
 * por un problema que no existe.
 */

export interface Regla {
  /** Fallos permitidos dentro de la ventana. */
  intentos: number
  /** Tamaño de la ventana, en segundos. */
  ventanaSegundos: number
  /** Cuánto se bloquea al pasarse. */
  bloqueoSegundos: number
}

/**
 * Estricta por (IP + correo): quien insiste sobre UNA cuenta.
 * Holgada por IP: quien barre cuentas distintas desde el mismo lugar, con
 * margen para que una oficina detrás de un NAT no se bloquee sola.
 */
export const REGLAS: { porCuenta: Regla; porOrigen: Regla } = {
  porCuenta: { intentos: 5, ventanaSegundos: 900, bloqueoSegundos: 900 },
  porOrigen: { intentos: 30, ventanaSegundos: 900, bloqueoSegundos: 600 },
}

interface Marca {
  fallos: number
  /** Epoch ms del primer fallo de la ventana vigente. */
  desde: number
  /** Epoch ms hasta el que está bloqueado, o 0. */
  bloqueadoHasta: number
}

export interface Veredicto {
  permitido: boolean
  /** Segundos que faltan para poder reintentar. 0 si está permitido. */
  esperaSegundos: number
  /** Cuántos fallos quedan antes del bloqueo. */
  intentosRestantes: number
}

const PERMITIDO_SIN_HISTORIAL: Veredicto = {
  permitido: true,
  esperaSegundos: 0,
  intentosRestantes: REGLAS.porCuenta.intentos,
}

/**
 * Registro de intentos. Se expone la clase para poder probarla con un reloj
 * inyectado; la aplicación usa la instancia compartida de abajo.
 */
export class RegistroDeIntentos {
  private readonly marcas = new Map<string, Marca>()

  /** ¿Puede intentar? No cuenta nada: solo consulta. */
  evaluar(clave: string, regla: Regla, ahora: number): Veredicto {
    const marca = this.marcas.get(clave)
    if (!marca) return { ...PERMITIDO_SIN_HISTORIAL, intentosRestantes: regla.intentos }

    if (marca.bloqueadoHasta > ahora) {
      return {
        permitido: false,
        esperaSegundos: Math.ceil((marca.bloqueadoHasta - ahora) / 1000),
        intentosRestantes: 0,
      }
    }

    // Ventana expirada: cuenta como si empezara de cero.
    if (ahora - marca.desde > regla.ventanaSegundos * 1000) {
      return { permitido: true, esperaSegundos: 0, intentosRestantes: regla.intentos }
    }

    return {
      permitido: true,
      esperaSegundos: 0,
      intentosRestantes: Math.max(0, regla.intentos - marca.fallos),
    }
  }

  /** Anota un fallo y devuelve el veredicto ya actualizado. */
  anotarFallo(clave: string, regla: Regla, ahora: number): Veredicto {
    const marca = this.marcas.get(clave)

    const vigente =
      marca && ahora - marca.desde <= regla.ventanaSegundos * 1000
        ? marca
        : { fallos: 0, desde: ahora, bloqueadoHasta: 0 }

    vigente.fallos += 1

    if (vigente.fallos >= regla.intentos) {
      vigente.bloqueadoHasta = ahora + regla.bloqueoSegundos * 1000
    }

    this.marcas.set(clave, vigente)

    return vigente.bloqueadoHasta > ahora
      ? {
          permitido: false,
          esperaSegundos: Math.ceil((vigente.bloqueadoHasta - ahora) / 1000),
          intentosRestantes: 0,
        }
      : {
          permitido: true,
          esperaSegundos: 0,
          intentosRestantes: Math.max(0, regla.intentos - vigente.fallos),
        }
  }

  /** Limpia el historial tras un acceso correcto. */
  perdonar(clave: string): void {
    this.marcas.delete(clave)
  }

  /**
   * Descarta marcas ya expiradas. Sin esto, el Map crece sin techo con cada
   * correo que alguien teclee mal: es una fuga de memoria lenta y un vector de
   * agotamiento para quien lo note.
   */
  podar(ahora: number, maxEdadSegundos = 3600): number {
    let removidas = 0
    for (const [clave, marca] of this.marcas) {
      const expirada =
        marca.bloqueadoHasta <= ahora &&
        ahora - marca.desde > maxEdadSegundos * 1000
      if (expirada) {
        this.marcas.delete(clave)
        removidas++
      }
    }
    return removidas
  }

  /** Solo para pruebas y diagnóstico. */
  get tamano(): number {
    return this.marcas.size
  }
}

const registro = new RegistroDeIntentos()

/** Normaliza el correo para que `A@x.com` y `a@X.com ` sean la misma clave. */
function clavear(correo: string): string {
  return correo.trim().toLowerCase()
}

export interface Contexto {
  ip: string
  correo: string
}

/**
 * ¿Se le permite intentar? Consulta las dos dimensiones y devuelve la más
 * restrictiva.
 */
export function evaluarAcceso(ctx: Contexto, ahora = Date.now()): Veredicto {
  // Se poda de forma oportunista: sin proceso de limpieza aparte, y el costo se
  // reparte entre las peticiones.
  if (Math.random() < 0.01) registro.podar(ahora)

  const porCuenta = registro.evaluar(
    `cuenta:${ctx.ip}:${clavear(ctx.correo)}`,
    REGLAS.porCuenta,
    ahora,
  )
  const porOrigen = registro.evaluar(`origen:${ctx.ip}`, REGLAS.porOrigen, ahora)

  return masRestrictivo(porCuenta, porOrigen)
}

/** Anota un fallo en ambas dimensiones. */
export function anotarFallo(ctx: Contexto, ahora = Date.now()): Veredicto {
  const porCuenta = registro.anotarFallo(
    `cuenta:${ctx.ip}:${clavear(ctx.correo)}`,
    REGLAS.porCuenta,
    ahora,
  )
  const porOrigen = registro.anotarFallo(
    `origen:${ctx.ip}`,
    REGLAS.porOrigen,
    ahora,
  )

  return masRestrictivo(porCuenta, porOrigen)
}

/** Limpia el historial tras entrar bien. */
export function perdonarAcceso(ctx: Contexto): void {
  registro.perdonar(`cuenta:${ctx.ip}:${clavear(ctx.correo)}`)
  registro.perdonar(`origen:${ctx.ip}`)
}

export function masRestrictivo(a: Veredicto, b: Veredicto): Veredicto {
  if (!a.permitido || !b.permitido) {
    return {
      permitido: false,
      esperaSegundos: Math.max(a.esperaSegundos, b.esperaSegundos),
      intentosRestantes: 0,
    }
  }
  return {
    permitido: true,
    esperaSegundos: 0,
    intentosRestantes: Math.min(a.intentosRestantes, b.intentosRestantes),
  }
}

/** Mensaje para el usuario. No dice si el correo existe. */
export function mensajeDeEspera(veredicto: Veredicto): string {
  const minutos = Math.ceil(veredicto.esperaSegundos / 60)
  return `Demasiados intentos fallidos. Vuelve a intentar en ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`
}

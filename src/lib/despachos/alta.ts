/**
 * Alta de despacho y validación del registro (motor puro, sin efectos).
 *
 * El registro crea cuatro cosas de un jalón: la cuenta de auth, el perfil, el
 * despacho y la membresía de titular. Aquí vive el criterio; la Server Action
 * se queda con la escritura.
 */

export interface Problema {
  campo: string
  mensaje: string
}

// ---------------------------------------------------------------------------
// Slug
// ---------------------------------------------------------------------------

/** Tope generoso pero acotado: el slug va en URLs y en direcciones de correo. */
const LARGO_MAX_SLUG = 40

/**
 * Convierte el nombre del despacho en un identificador para URLs.
 *
 *   "Despacho Pérez & Asociados, S.C."  →  "despacho-perez-asociados"
 *
 * El `&` se descarta en vez de volverse "y": un slug es un identificador, no
 * una traducción, y "perez-y-asociados" sorprende a quien lo escribe a mano.
 */
export function slugDeDespacho(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, LARGO_MAX_SLUG)
    // El recorte puede dejar un guion colgando al final.
    .replace(/-+$/, '')

  // Un nombre puramente no latino (o solo símbolos) se quedaría sin slug. Antes
  // que fallar el registro, se le da uno neutro y el titular lo cambia después.
  return base.length > 0 ? base : 'despacho'
}

// ---------------------------------------------------------------------------
// Validación del registro
// ---------------------------------------------------------------------------

export interface DatosRegistro {
  nombre: string
  correo: string
  contrasena: string
  nombreDespacho: string
}

/**
 * Mínimo de contraseña.
 *
 * Diez y no seis (el default de Supabase) porque una cuenta de aquí abre los
 * expedientes de un despacho entero. Y NO se exigen mayúsculas, números ni
 * símbolos: las reglas de composición empujan a la gente a "Despacho1!" —que un
 * diccionario rompe— y a apuntar la contraseña en un papel. Lo que de verdad
 * cuesta romper es la longitud.
 */
const LARGO_MIN_CONTRASENA = 10

/**
 * bcrypt trunca a 72 bytes. Aceptar más da la falsa impresión de que los
 * caracteres extra cuentan.
 */
const LARGO_MAX_CONTRASENA = 72

/** Deliberadamente laxo: el correo real se valida confirmándolo, no con regex. */
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function correoValido(correo: string): boolean {
  return PATRON_CORREO.test(correo.trim())
}

export function validarRegistro(datos: DatosRegistro): Problema[] {
  const problemas: Problema[] = []

  const nombre = datos.nombre.trim()
  const correo = datos.correo.trim()
  const nombreDespacho = datos.nombreDespacho.trim()

  if (nombre.length < 2) {
    problemas.push({ campo: 'nombre', mensaje: 'Escribe tu nombre.' })
  }

  if (!correoValido(correo)) {
    problemas.push({ campo: 'correo', mensaje: 'El correo no parece válido.' })
  }

  if (datos.contrasena.length < LARGO_MIN_CONTRASENA) {
    problemas.push({
      campo: 'contrasena',
      mensaje: `La contraseña necesita al menos ${LARGO_MIN_CONTRASENA} caracteres.`,
    })
  } else if (Buffer.byteLength(datos.contrasena, 'utf8') > LARGO_MAX_CONTRASENA) {
    problemas.push({
      campo: 'contrasena',
      mensaje: `La contraseña no puede pasar de ${LARGO_MAX_CONTRASENA} bytes.`,
    })
  }

  // Una contraseña que contiene el correo es adivinable de entrada.
  const usuario = correo.split('@')[0]?.toLowerCase() ?? ''
  if (
    usuario.length >= 4 &&
    datos.contrasena.toLowerCase().includes(usuario)
  ) {
    problemas.push({
      campo: 'contrasena',
      mensaje: 'La contraseña no puede contener tu correo.',
    })
  }

  if (nombreDespacho.length < 3) {
    problemas.push({
      campo: 'nombreDespacho',
      mensaje: 'Escribe el nombre del despacho.',
    })
  }

  return problemas
}

export interface PlanDeRegistro {
  nombre: string
  correo: string
  despacho: { nombre: string; slugBase: string }
}

export type ResultadoRegistro =
  | { ok: true; plan: PlanDeRegistro }
  | { ok: false; problemas: readonly Problema[] }

/**
 * Valida y arma lo que hay que escribir.
 *
 * El slug que sale de aquí es solo la BASE. Resolver una colisión exige leer
 * los slugs de todos los despachos, y la RLS —con razón— no deja que un
 * despacho vea a los demás. Por eso el desempate ocurre dentro de
 * `crear_mi_despacho` (migración 0006), que corre en una transacción y es la
 * única implementación de esa regla: tenerla también aquí garantizaría que las
 * dos versiones se separen con el tiempo.
 */
export function prepararRegistro(datos: DatosRegistro): ResultadoRegistro {
  const problemas = validarRegistro(datos)
  if (problemas.length > 0) return { ok: false, problemas }

  const nombreDespacho = datos.nombreDespacho.trim()

  return {
    ok: true,
    plan: {
      nombre: datos.nombre.trim(),
      correo: datos.correo.trim().toLowerCase(),
      despacho: {
        nombre: nombreDespacho,
        slugBase: slugDeDespacho(nombreDespacho),
      },
    },
  }
}

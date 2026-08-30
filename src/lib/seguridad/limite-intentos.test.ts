import { describe, expect, it } from 'vitest'

import {
  RegistroDeIntentos,
  masRestrictivo,
  mensajeDeEspera,
  type Regla,
} from './limite-intentos'

/** Regla chica y explícita: 3 fallos en 60 s bloquean 120 s. */
const REGLA: Regla = { intentos: 3, ventanaSegundos: 60, bloqueoSegundos: 120 }

const T0 = 1_700_000_000_000
const seg = (n: number) => T0 + n * 1000

describe('RegistroDeIntentos', () => {
  it('permite sin historial', () => {
    const r = new RegistroDeIntentos()
    const v = r.evaluar('a', REGLA, T0)

    expect(v.permitido).toBe(true)
    expect(v.intentosRestantes).toBe(3)
  })

  it('descuenta con cada fallo', () => {
    const r = new RegistroDeIntentos()

    expect(r.anotarFallo('a', REGLA, T0).intentosRestantes).toBe(2)
    expect(r.anotarFallo('a', REGLA, seg(1)).intentosRestantes).toBe(1)
  })

  it('bloquea al agotar los intentos', () => {
    const r = new RegistroDeIntentos()
    r.anotarFallo('a', REGLA, T0)
    r.anotarFallo('a', REGLA, seg(1))
    const v = r.anotarFallo('a', REGLA, seg(2))

    expect(v.permitido).toBe(false)
    expect(v.esperaSegundos).toBe(120)
  })

  it('sigue bloqueado mientras dura el castigo', () => {
    const r = new RegistroDeIntentos()
    for (let i = 0; i < 3; i++) r.anotarFallo('a', REGLA, seg(i))

    expect(r.evaluar('a', REGLA, seg(100)).permitido).toBe(false)
    expect(r.evaluar('a', REGLA, seg(100)).esperaSegundos).toBe(22)
  })

  it('vuelve a permitir cuando expira el bloqueo', () => {
    const r = new RegistroDeIntentos()
    for (let i = 0; i < 3; i++) r.anotarFallo('a', REGLA, seg(i))

    expect(r.evaluar('a', REGLA, seg(500)).permitido).toBe(true)
  })

  it('los fallos viejos no cuentan: la ventana se reinicia', () => {
    const r = new RegistroDeIntentos()
    r.anotarFallo('a', REGLA, T0)
    r.anotarFallo('a', REGLA, seg(1))

    // A los 200 s la ventana de 60 ya expiró; se empieza de cero.
    expect(r.anotarFallo('a', REGLA, seg(200)).intentosRestantes).toBe(2)
  })

  it('perdonar limpia el historial', () => {
    // Sin esto, quien entra bien cinco veces en la mañana —teléfono, laptop,
    // otra pestaña— acabaría bloqueándose solo.
    const r = new RegistroDeIntentos()
    r.anotarFallo('a', REGLA, T0)
    r.anotarFallo('a', REGLA, seg(1))
    r.perdonar('a')

    expect(r.evaluar('a', REGLA, seg(2)).intentosRestantes).toBe(3)
  })

  it('cada clave lleva su propia cuenta', () => {
    const r = new RegistroDeIntentos()
    for (let i = 0; i < 3; i++) r.anotarFallo('a', REGLA, seg(i))

    expect(r.evaluar('a', REGLA, seg(4)).permitido).toBe(false)
    expect(r.evaluar('b', REGLA, seg(4)).permitido).toBe(true)
  })

  it('poda las marcas viejas para no crecer sin techo', () => {
    // Sin poda, el Map crece con cada correo que alguien teclee mal: fuga de
    // memoria lenta y vector de agotamiento para quien lo note.
    const r = new RegistroDeIntentos()
    r.anotarFallo('vieja', REGLA, T0)
    r.anotarFallo('nueva', REGLA, seg(7200))

    expect(r.tamano).toBe(2)
    r.podar(seg(7200), 3600)
    expect(r.tamano).toBe(1)
    expect(r.evaluar('nueva', REGLA, seg(7200)).intentosRestantes).toBe(2)
  })

  it('no poda una marca todavía bloqueada', () => {
    const r = new RegistroDeIntentos()
    for (let i = 0; i < 3; i++) r.anotarFallo('a', REGLA, seg(i))

    // Vieja según la edad, pero el bloqueo sigue vivo.
    r.podar(seg(60), 30)
    expect(r.evaluar('a', REGLA, seg(60)).permitido).toBe(false)
  })
})

describe('masRestrictivo', () => {
  const libre = { permitido: true, esperaSegundos: 0, intentosRestantes: 5 }
  const apretado = { permitido: true, esperaSegundos: 0, intentosRestantes: 1 }
  const bloqueado = { permitido: false, esperaSegundos: 300, intentosRestantes: 0 }

  it('un bloqueo gana sobre cualquier permiso', () => {
    expect(masRestrictivo(libre, bloqueado).permitido).toBe(false)
    expect(masRestrictivo(bloqueado, libre).permitido).toBe(false)
  })

  it('toma la espera más larga', () => {
    const otro = { permitido: false, esperaSegundos: 900, intentosRestantes: 0 }
    expect(masRestrictivo(bloqueado, otro).esperaSegundos).toBe(900)
  })

  it('entre dos permisos, deja el menor margen', () => {
    expect(masRestrictivo(libre, apretado).intentosRestantes).toBe(1)
  })
})

describe('mensajeDeEspera', () => {
  it('redondea hacia arriba y concuerda el plural', () => {
    expect(
      mensajeDeEspera({ permitido: false, esperaSegundos: 30, intentosRestantes: 0 }),
    ).toMatch(/1 minuto\./)
    expect(
      mensajeDeEspera({ permitido: false, esperaSegundos: 61, intentosRestantes: 0 }),
    ).toMatch(/2 minutos\./)
  })

  it('no revela si el correo existe', () => {
    const mensaje = mensajeDeEspera({
      permitido: false,
      esperaSegundos: 60,
      intentosRestantes: 0,
    })
    expect(mensaje).not.toMatch(/correo|cuenta|usuario/i)
  })
})

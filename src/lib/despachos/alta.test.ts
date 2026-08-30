import { describe, expect, it } from 'vitest'

import {
  correoValido,
  prepararRegistro,
  slugDeDespacho,
  validarRegistro,
  type DatosRegistro,
} from './alta'

function datos(over: Partial<DatosRegistro> = {}): DatosRegistro {
  return {
    nombre: 'Danny Ramírez',
    correo: 'danny@despacho.mx',
    contrasena: 'unacontrasenalarga',
    nombreDespacho: 'Despacho Pérez & Asociados, S.C.',
    ...over,
  }
}

describe('slugDeDespacho', () => {
  it('quita acentos, puntuación y símbolos', () => {
    expect(slugDeDespacho('Despacho Pérez & Asociados, S.C.')).toBe(
      'despacho-perez-asociados-s-c',
    )
  })

  it('no deja guiones colgando en los extremos', () => {
    expect(slugDeDespacho('  ¡Bufete Muñoz!  ')).toBe('bufete-munoz')
    expect(slugDeDespacho('---Litis---')).toBe('litis')
  })

  it('colapsa separadores repetidos', () => {
    expect(slugDeDespacho('A   &&&   B')).toBe('a-b')
  })

  it('recorta al tope sin dejar guion final', () => {
    const largo = slugDeDespacho('Despacho de Abogados Asociados del Norte de la República')
    expect(largo.length).toBeLessThanOrEqual(40)
    expect(largo.endsWith('-')).toBe(false)
  })

  it('da un slug neutro en vez de quedarse vacío', () => {
    // Antes que reventar el registro por un nombre no latino.
    expect(slugDeDespacho('事務所')).toBe('despacho')
    expect(slugDeDespacho('!!!')).toBe('despacho')
  })
})

describe('correoValido', () => {
  it('acepta correos normales', () => {
    expect(correoValido('danny@despacho.mx')).toBe(true)
    expect(correoValido('  a.b+c@sub.dominio.com  ')).toBe(true)
  })

  it('rechaza lo que claramente no lo es', () => {
    expect(correoValido('danny')).toBe(false)
    expect(correoValido('danny@')).toBe(false)
    expect(correoValido('danny@dominio')).toBe(false)
    expect(correoValido('a b@c.com')).toBe(false)
  })
})

describe('validarRegistro', () => {
  it('acepta un registro bien formado', () => {
    expect(validarRegistro(datos())).toEqual([])
  })

  it('exige nombre y nombre de despacho', () => {
    expect(
      validarRegistro(datos({ nombre: 'A' })).some((p) => p.campo === 'nombre'),
    ).toBe(true)
    expect(
      validarRegistro(datos({ nombreDespacho: 'ab' })).some(
        (p) => p.campo === 'nombreDespacho',
      ),
    ).toBe(true)
  })

  it('exige longitud de contraseña, no composición', () => {
    // Diez caracteres de puras minúsculas pasan; nueve no. Las reglas de
    // composición empujan a "Despacho1!", que un diccionario rompe.
    expect(
      validarRegistro(datos({ contrasena: 'abcdefghij' })).some(
        (p) => p.campo === 'contrasena',
      ),
    ).toBe(false)
    expect(
      validarRegistro(datos({ contrasena: 'abcdefghi' })).some(
        (p) => p.campo === 'contrasena',
      ),
    ).toBe(true)
  })

  it('rechaza una contraseña más larga de lo que bcrypt considera', () => {
    const problemas = validarRegistro(datos({ contrasena: 'x'.repeat(73) }))
    expect(problemas.some((p) => /72 bytes/.test(p.mensaje))).toBe(true)
  })

  it('rechaza una contraseña que contiene el correo', () => {
    const problemas = validarRegistro(
      datos({ correo: 'danny@despacho.mx', contrasena: 'danny-segura-1' }),
    )
    expect(problemas.some((p) => /no puede contener tu correo/.test(p.mensaje))).toBe(
      true,
    )
  })

  it('no confunde un usuario corto con una coincidencia', () => {
    // "ab" aparece en casi cualquier cadena; exigir 4+ evita el falso positivo.
    expect(
      validarRegistro(
        datos({ correo: 'ab@despacho.mx', contrasena: 'abogadosdelnorte' }),
      ),
    ).toEqual([])
  })

  it('junta todos los problemas en vez de parar en el primero', () => {
    const problemas = validarRegistro(
      datos({ nombre: '', correo: 'x', contrasena: '123', nombreDespacho: '' }),
    )
    expect(problemas.length).toBeGreaterThanOrEqual(4)
  })
})

describe('prepararRegistro', () => {
  it('arma el plan con el slug base', () => {
    // Solo la BASE: el desempate ante una colisión ocurre en SQL, porque la
    // RLS no deja que un despacho lea los slugs de los demás.
    const r = prepararRegistro(datos())

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.plan.despacho.slugBase).toBe('despacho-perez-asociados-s-c')
    expect(r.plan.despacho.nombre).toBe('Despacho Pérez & Asociados, S.C.')
  })

  it('normaliza el correo a minúsculas y recorta espacios', () => {
    const r = prepararRegistro(
      datos({ correo: '  Danny@Despacho.MX  ', nombre: '  Danny  ' }),
    )
    if (!r.ok) throw new Error('debió pasar la validación')

    expect(r.plan.correo).toBe('danny@despacho.mx')
    expect(r.plan.nombre).toBe('Danny')
  })

  it('devuelve los problemas y ningún plan si algo falta', () => {
    const r = prepararRegistro(datos({ contrasena: '123' }))
    expect(r.ok).toBe(false)
  })
})

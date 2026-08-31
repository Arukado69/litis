import { describe, expect, it } from 'vitest'

import {
  DIAS_DE_VIGENCIA,
  ROLES_INVITABLES,
  enlaceDeInvitacion,
  estaVigente,
  expiraEl,
  generarToken,
  hashDeToken,
  leerInvitacion,
  mismoHash,
  normalizarCorreo,
  puedeCambiarRol,
  puedeDarDeBaja,
  validarInvitacion,
  type ContextoInvitacion,
  type MiembroDelEquipo,
} from './invitaciones'

const CONTEXTO: ContextoInvitacion = {
  correosDelEquipo: ['nadia@despacho.mx'],
  correosInvitados: ['danny@despacho.mx'],
  correoDeQuienInvita: 'titular@despacho.mx',
}

function miembro(over: Partial<MiembroDelEquipo> = {}): MiembroDelEquipo {
  return {
    perfilId: 'perfil-2',
    nombre: 'Danny Salas',
    correo: 'danny@despacho.mx',
    rol: 'abogado',
    estado: 'activa',
    ...over,
  }
}

describe('el token', () => {
  it('no se repite', () => {
    // Con 256 bits de entropía, dos iguales en mil intentos significaría que el
    // generador está roto, no mala suerte.
    const vistos = new Set<string>()
    for (let i = 0; i < 1000; i += 1) vistos.add(generarToken())
    expect(vistos.size).toBe(1000)
  })

  it('es largo y seguro para una URL', () => {
    const token = generarToken()
    expect(token.length).toBeGreaterThanOrEqual(43)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('el hash es sha-256 en hexadecimal, que es lo que exige la base', () => {
    // La 0009 tiene un `check` con este mismo patrón.
    expect(hashDeToken('lo-que-sea')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('el mismo token da el mismo hash', () => {
    const token = generarToken()
    expect(hashDeToken(token)).toBe(hashDeToken(token))
  })

  it('tokens distintos dan hashes distintos', () => {
    expect(hashDeToken('a')).not.toBe(hashDeToken('b'))
  })

  it('del hash no se recupera el token', () => {
    const token = generarToken()
    expect(hashDeToken(token)).not.toContain(token)
  })
})

describe('mismoHash', () => {
  it('reconoce dos hashes iguales', () => {
    const h = hashDeToken('token')
    expect(mismoHash(h, h)).toBe(true)
  })

  it('rechaza dos distintos', () => {
    expect(mismoHash(hashDeToken('a'), hashDeToken('b'))).toBe(false)
  })

  it('no revienta con longitudes distintas', () => {
    // `timingSafeEqual` lanza si los buffers no miden lo mismo; aquí se
    // contesta `false`, que es la respuesta correcta.
    expect(mismoHash('corto', hashDeToken('a'))).toBe(false)
  })
})

describe('normalizarCorreo', () => {
  it('recorta y baja a minúsculas', () => {
    // Se compara contra el correo de la sesión al aceptar: "Nadia@X.com" no
    // puede fallar contra "nadia@x.com".
    expect(normalizarCorreo('  Nadia@Despacho.MX ')).toBe('nadia@despacho.mx')
  })

  it('lo vacío queda vacío, no undefined', () => {
    expect(normalizarCorreo(undefined)).toBe('')
  })
})

describe('leerInvitacion', () => {
  it('lee lo que manda el formulario', () => {
    const leido = leerInvitacion({ correo: ' ANA@x.mx ', rol: 'pasante' })
    expect(leido).toEqual({ correo: 'ana@x.mx', rol: 'pasante' })
  })

  it('un rol inventado cae en abogado en vez de romper', () => {
    expect(leerInvitacion({ correo: 'a@b.mx', rol: 'dueño' }).rol).toBe('abogado')
  })

  it('no deja colar el rol de titular por el formulario', () => {
    // Hay un titular y es quien creó el despacho. Dos titulares dejan la
    // pregunta "quién manda" sin respuesta.
    expect(leerInvitacion({ correo: 'a@b.mx', rol: 'titular' }).rol).toBe('abogado')
  })

  it('tampoco el de cliente: ese entra por el portal, no por aquí', () => {
    expect(leerInvitacion({ correo: 'a@b.mx', rol: 'cliente' }).rol).toBe('abogado')
  })
})

describe('validarInvitacion', () => {
  it('acepta una invitación normal', () => {
    expect(
      validarInvitacion({ correo: 'nuevo@despacho.mx', rol: 'abogado' }, CONTEXTO),
    ).toEqual([])
  })

  it('rechaza un correo que no es correo', () => {
    for (const correo of ['', 'nadia', 'nadia@', '@x.mx', 'nadia@x']) {
      const problemas = validarInvitacion({ correo, rol: 'abogado' }, CONTEXTO)
      expect(problemas.map((p) => p.campo)).toContain('correo')
    }
  })

  it('no deja invitarse a uno mismo', () => {
    const problemas = validarInvitacion(
      { correo: 'titular@despacho.mx', rol: 'abogado' },
      CONTEXTO,
    )
    expect(problemas[0]?.mensaje).toMatch(/tu propio correo/i)
  })

  it('no deja invitar a quien ya está dentro', () => {
    const problemas = validarInvitacion(
      { correo: 'nadia@despacho.mx', rol: 'abogado' },
      CONTEXTO,
    )
    expect(problemas[0]?.mensaje).toMatch(/ya está en el despacho/i)
  })

  it('no deja duplicar una invitación pendiente', () => {
    // Reinvitar sin cerrar la anterior deja dos enlaces vivos, y revocar uno no
    // cierra el otro.
    const problemas = validarInvitacion(
      { correo: 'danny@despacho.mx', rol: 'abogado' },
      CONTEXTO,
    )
    expect(problemas[0]?.mensaje).toMatch(/pendiente/i)
  })

  it('compara sin importar mayúsculas', () => {
    const problemas = validarInvitacion(
      { correo: normalizarCorreo('NADIA@Despacho.mx'), rol: 'abogado' },
      CONTEXTO,
    )
    expect(problemas).toHaveLength(1)
  })
})

describe('vigencia', () => {
  const AHORA = new Date('2026-09-03T12:00:00Z')

  it('caduca a los siete días', () => {
    const fin = expiraEl(AHORA)
    const dias = (fin.getTime() - AHORA.getTime()) / (24 * 60 * 60 * 1000)
    expect(dias).toBe(DIAS_DE_VIGENCIA)
  })

  it('una pendiente sin caducar está vigente', () => {
    expect(
      estaVigente(
        { estado: 'pendiente', expiraEl: '2026-09-05T12:00:00Z' },
        AHORA,
      ),
    ).toBe(true)
  })

  it('una pendiente caducada ya no', () => {
    // Un enlace eterno en un correo viejo es una puerta abierta que nadie ve.
    expect(
      estaVigente(
        { estado: 'pendiente', expiraEl: '2026-09-01T12:00:00Z' },
        AHORA,
      ),
    ).toBe(false)
  })

  it('una revocada no revive aunque le sobre tiempo', () => {
    expect(
      estaVigente({ estado: 'revocada', expiraEl: '2026-12-01T00:00:00Z' }, AHORA),
    ).toBe(false)
  })

  it('una ya aceptada no sirve dos veces', () => {
    expect(
      estaVigente({ estado: 'aceptada', expiraEl: '2026-12-01T00:00:00Z' }, AHORA),
    ).toBe(false)
  })
})

describe('enlaceDeInvitacion', () => {
  it('arma el enlace con el token', () => {
    expect(enlaceDeInvitacion('https://litis.mx', 'abc123')).toBe(
      'https://litis.mx/invitacion/abc123',
    )
  })

  it('no duplica la diagonal', () => {
    expect(enlaceDeInvitacion('https://litis.mx/', 'abc')).toBe(
      'https://litis.mx/invitacion/abc',
    )
  })
})

describe('puedeDarDeBaja', () => {
  it('deja dar de baja a un abogado', () => {
    expect(puedeDarDeBaja(miembro(), 'perfil-1')).toBeNull()
  })

  it('al titular no', () => {
    // Un despacho sin titular no tiene quién invite ni administre, y nadie
    // puede arreglarlo desde dentro.
    const problema = puedeDarDeBaja(miembro({ rol: 'titular' }), 'perfil-1')
    expect(problema?.mensaje).toMatch(/titular/i)
  })

  it('nadie se da de baja a sí mismo', () => {
    expect(puedeDarDeBaja(miembro(), 'perfil-2')).not.toBeNull()
  })
})

describe('puedeCambiarRol', () => {
  it('deja mover a un abogado a pasante', () => {
    expect(puedeCambiarRol(miembro(), 'pasante')).toBeNull()
  })

  it('no deja tocar al titular', () => {
    expect(puedeCambiarRol(miembro({ rol: 'titular' }), 'abogado')).not.toBeNull()
  })

  it('no deja nombrar a un segundo titular', () => {
    expect(puedeCambiarRol(miembro(), 'titular')).not.toBeNull()
  })

  it('no deja convertir a alguien del equipo en cliente', () => {
    expect(puedeCambiarRol(miembro(), 'cliente')).not.toBeNull()
  })

  it('todos los invitables se pueden asignar', () => {
    for (const rol of ROLES_INVITABLES) {
      expect(puedeCambiarRol(miembro(), rol)).toBeNull()
    }
  })
})

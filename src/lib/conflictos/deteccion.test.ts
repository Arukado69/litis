import { describe, expect, it } from 'vitest'

import {
  compararNombres,
  normalizarNombre,
  normalizarRfc,
  revisarConflictos,
  type ParteEnEstudio,
  type RegistroExistente,
} from './deteccion'

function registro(over: Partial<RegistroExistente> = {}): RegistroExistente {
  return {
    id: 'r1',
    nombre: 'Constructora XYZ, S.A. de C.V.',
    rfc: 'CXY010203AB1',
    relacion: 'cliente_activo',
    expedienteId: 'e9',
    caratula: 'Constructora XYZ vs. Banco',
    ...over,
  }
}

function parte(over: Partial<ParteEnEstudio> = {}): ParteEnEstudio {
  return { nombre: 'Juan Pérez', rfc: null, esNuestraParte: false, ...over }
}

describe('normalizarNombre', () => {
  it('quita acentos, puntuación y sufijo societario', () => {
    expect(normalizarNombre('Constructora XYZ, S.A. de C.V.')).toBe(
      'CONSTRUCTORA XYZ',
    )
    expect(normalizarNombre('CONSTRUCTORA XYZ SA DE CV')).toBe(
      'CONSTRUCTORA XYZ',
    )
    expect(normalizarNombre('Pérez Gómez')).toBe('PEREZ GOMEZ')
  })

  it('no confunde el sufijo largo con el corto', () => {
    // Si se recortara "SA" primero quedaría "... DE CV" colgando.
    expect(normalizarNombre('Grupo Alfa S.A. de C.V.')).toBe('GRUPO ALFA')
    expect(normalizarNombre('Servicios Beta, S. de R.L. de C.V.')).toBe(
      'SERVICIOS BETA',
    )
  })

  it('pliega la Ñ a N para no perder coincidencias por captura', () => {
    // Se prefiere el falso positivo: "Munoz" y "Muñoz" son la misma persona
    // tecleada por dos manos distintas, y dejarlas sin empatar sería un falso
    // negativo en una revisión de conflictos.
    expect(normalizarNombre('Muñoz Peña')).toBe('MUNOZ PENA')
    expect(normalizarNombre('Munoz Pena')).toBe('MUNOZ PENA')
  })

  it('colapsa espacios de más', () => {
    expect(normalizarNombre('  Juan   Pérez  ')).toBe('JUAN PEREZ')
  })
})

describe('normalizarRfc', () => {
  it('limpia separadores y sube a mayúsculas', () => {
    expect(normalizarRfc('cxy-010203-ab1')).toBe('CXY010203AB1')
    expect(normalizarRfc('PEGJ 800101 HX4')).toBe('PEGJ800101HX4')
  })

  it('descarta un RFC demasiado corto para cotejar', () => {
    // Un dato incompleto cotejado produce falsos positivos en cadena.
    expect(normalizarRfc('PEGJ80')).toBeNull()
    expect(normalizarRfc(null)).toBeNull()
    expect(normalizarRfc('')).toBeNull()
  })
})

describe('compararNombres', () => {
  it('detecta identidad pese a la forma de captura', () => {
    expect(
      compararNombres('Constructora XYZ, S.A. de C.V.', 'CONSTRUCTORA XYZ SA DE CV'),
    ).toBe('nombre_identico')
  })

  it('detecta un nombre contenido en otro más largo', () => {
    expect(compararNombres('Juan Pérez', 'Juan Pérez García')).toBe(
      'nombre_contenido',
    )
  })

  it('no coincide con un solo token significativo', () => {
    // "Constructora" sola coincidiría con media ciudad.
    expect(compararNombres('Constructora', 'Constructora XYZ')).toBeNull()
  })

  it('ignora palabras que no distinguen a nadie', () => {
    expect(compararNombres('Grupo Alfa Beta', 'Alfa Beta')).toBe(
      'nombre_contenido',
    )
  })

  it('no inventa coincidencias entre nombres distintos', () => {
    expect(compararNombres('Juan Pérez', 'María López')).toBeNull()
  })

  it('trata el vacío como no coincidencia', () => {
    expect(compararNombres('', 'Juan Pérez')).toBeNull()
  })
})

describe('revisarConflictos', () => {
  it('marca impedimento al actuar contra un cliente activo', () => {
    const r = revisarConflictos({
      partes: [parte({ nombre: 'Constructora XYZ SA de CV' })],
      padron: [registro()],
    })

    expect(r.nivelMaximo).toBe('impedimento')
    expect(r.requiereConstancia).toBe(true)
    expect(r.hallazgos[0]?.motivo).toMatch(/CONTRA un cliente activo/)
  })

  it('no marca impedimento si esa persona es nuestra propia parte', () => {
    // Representar a nuestro cliente en un asunto nuevo no es conflicto.
    const r = revisarConflictos({
      partes: [
        parte({ nombre: 'Constructora XYZ SA de CV', esNuestraParte: true }),
      ],
      padron: [registro()],
    })

    expect(r.nivelMaximo).toBeNull()
    expect(r.hallazgos).toHaveLength(0)
  })

  it('pide revisión al actuar contra un ex cliente', () => {
    const r = revisarConflictos({
      partes: [parte({ nombre: 'Constructora XYZ SA de CV' })],
      padron: [registro({ relacion: 'cliente_anterior' })],
    })

    expect(r.nivelMaximo).toBe('revisar')
    expect(r.hallazgos[0]?.motivo).toMatch(/conexo/)
  })

  it('avisa si vamos a representar a quien tenemos como contraparte', () => {
    const r = revisarConflictos({
      partes: [parte({ nombre: 'Juan Pérez', esNuestraParte: true })],
      padron: [
        registro({
          nombre: 'Juan Pérez',
          rfc: null,
          relacion: 'contraparte',
          caratula: 'Otro cliente vs. Juan Pérez',
        }),
      ],
    })

    expect(r.nivelMaximo).toBe('revisar')
    expect(r.hallazgos[0]?.motivo).toMatch(/posiciones encontradas/)
  })

  it('el RFC coincide aunque el nombre esté escrito distinto', () => {
    const r = revisarConflictos({
      partes: [
        parte({ nombre: 'Constructora del Bajío', rfc: 'cxy-010203-ab1' }),
      ],
      padron: [registro()],
    })

    expect(r.hallazgos[0]?.coincidencia).toBe('rfc')
    expect(r.nivelMaximo).toBe('impedimento')
  })

  it('ordena lo más grave y con mejor evidencia primero', () => {
    const r = revisarConflictos({
      partes: [parte({ nombre: 'Constructora XYZ', rfc: 'CXY010203AB1' })],
      padron: [
        registro({
          id: 'parecido',
          nombre: 'Constructora XYZ del Norte',
          rfc: null,
          relacion: 'contraparte',
        }),
        registro({ id: 'exacto' }),
      ],
    })

    expect(r.hallazgos[0]?.registro.id).toBe('exacto')
    expect(r.hallazgos[0]?.nivel).toBe('impedimento')
    expect(r.hallazgos[0]?.coincidencia).toBe('rfc')
  })

  it('sin coincidencias no pide constancia', () => {
    const r = revisarConflictos({
      partes: [parte({ nombre: 'María López' })],
      padron: [registro()],
    })

    expect(r.hallazgos).toHaveLength(0)
    expect(r.nivelMaximo).toBeNull()
    expect(r.requiereConstancia).toBe(false)
  })

  it('un padrón vacío no truena', () => {
    const r = revisarConflictos({ partes: [parte()], padron: [] })
    expect(r.hallazgos).toHaveLength(0)
  })
})

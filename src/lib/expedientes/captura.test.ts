import { describe, expect, it } from 'vitest'

import {
  leerCaptura,
  leerCuantia,
  leerFecha,
  validarCaptura,
  type CapturaAlta,
} from './captura'

function campos(over: Record<string, string> = {}): Record<string, string> {
  return {
    materia: 'mercantil',
    via: 'merc.ordinario',
    fuero: 'comun',
    clienteNombre: 'Juan Pérez',
    clienteRol: 'actor',
    contraparteNombre: 'Constructora XYZ',
    contraparteRol: 'demandado',
    ...over,
  }
}

function captura(over: Partial<CapturaAlta> = {}): CapturaAlta {
  return { ...leerCaptura(campos()), ...over }
}

describe('leerCuantia', () => {
  it('acepta lo que la gente teclea de verdad', () => {
    expect(leerCuantia('$1,250,000.00')).toBe(1250000)
    expect(leerCuantia('  850000 ')).toBe(850000)
    expect(leerCuantia('1250.50')).toBe(1250.5)
  })

  it('distingue "sin cuantía" de "cuantía cero"', () => {
    // Confundirlos haría que un asunto sin capturar apareciera como uno de
    // cero pesos.
    expect(leerCuantia('')).toBeNull()
    expect(leerCuantia(undefined)).toBeNull()
    expect(leerCuantia('0')).toBe(0)
  })

  it('descarta lo que no es un número utilizable', () => {
    expect(leerCuantia('mucho')).toBeNull()
    expect(leerCuantia('-500')).toBeNull()
    expect(leerCuantia('1e999')).toBeNull()
  })
})

describe('leerFecha', () => {
  it('acepta solo el formato ISO', () => {
    expect(leerFecha('2026-03-16')).toBe('2026-03-16')
    expect(leerFecha('  2026-03-16 ')).toBe('2026-03-16')
  })

  it('descarta otros formatos en vez de adivinar', () => {
    // 03/04/2026 es ambiguo entre marzo y abril según el país; adivinar aquí
    // arruinaría el cómputo de un plazo.
    expect(leerFecha('03/04/2026')).toBeNull()
    expect(leerFecha('16 de marzo')).toBeNull()
    expect(leerFecha('')).toBeNull()
  })
})

describe('leerCaptura', () => {
  it('convierte los campos crudos en la captura tipada', () => {
    const c = leerCaptura(
      campos({
        entidad: 'Ciudad de México',
        numeroOrgano: ' 123/2026 ',
        cuantia: '$500,000',
        fechaInicio: '2026-03-02',
        restringido: 'on',
      }),
    )

    expect(c.materia).toBe('mercantil')
    expect(c.numeroOrgano).toBe('123/2026')
    expect(c.cuantia).toBe(500000)
    expect(c.fechaInicio).toBe('2026-03-02')
    expect(c.restringido).toBe(true)
  })

  it('los campos vacíos quedan en null, no en cadena vacía', () => {
    const c = leerCaptura(campos({ entidad: '   ', instancia: '' }))
    expect(c.entidad).toBeNull()
    expect(c.instancia).toBeNull()
  })

  it('sin contraparte no inventa una', () => {
    // Un asunto puede abrirse antes de saber a quién se demanda.
    const c = leerCaptura(campos({ contraparteNombre: '' }))
    expect(c.contraparte).toBeNull()
  })

  it('lee la contraparte con su abogado', () => {
    const c = leerCaptura(campos({ contraparteAbogado: 'Lic. Ana Ruiz' }))
    expect(c.contraparte?.nombre).toBe('Constructora XYZ')
    expect(c.contraparte?.abogadoContrario).toBe('Lic. Ana Ruiz')
  })

  it('el tipo de persona por omisión es física', () => {
    expect(leerCaptura(campos()).nuestraParte.tipo).toBe('fisica')
    expect(
      leerCaptura(campos({ clienteTipo: 'moral' })).nuestraParte.tipo,
    ).toBe('moral')
  })

  it('el fuero por omisión es común', () => {
    expect(leerCaptura(campos({ fuero: '' })).fuero).toBe('comun')
    expect(leerCaptura(campos({ fuero: 'federal' })).fuero).toBe('federal')
  })
})

describe('validarCaptura', () => {
  it('acepta una captura completa', () => {
    expect(validarCaptura(captura())).toEqual([])
  })

  it('exige materia y vía', () => {
    const c = leerCaptura(campos({ materia: '', via: '' }))
    const problemas = validarCaptura(c)
    expect(problemas.some((p) => p.campo === 'materia')).toBe(true)
    expect(problemas.some((p) => p.campo === 'via')).toBe(true)
  })

  it('exige saber a quién se representa', () => {
    const c = leerCaptura(campos({ clienteNombre: '' }))
    expect(validarCaptura(c).some((p) => p.campo === 'clienteNombre')).toBe(true)
  })

  it('rechaza un rol que no existe en esa materia', () => {
    // "quejoso" es de amparo; en mercantil no significa nada.
    const c = leerCaptura(campos({ clienteRol: 'quejoso' }))
    expect(validarCaptura(c).some((p) => p.campo === 'clienteRol')).toBe(true)
  })

  it('acepta el rol propio de la materia', () => {
    const c = leerCaptura(
      campos({
        materia: 'amparo',
        via: 'amp.indirecto',
        fuero: 'federal',
        clienteRol: 'quejoso',
        contraparteRol: 'autoridad_responsable',
      }),
    )
    expect(validarCaptura(c)).toEqual([])
  })

  it('rechaza que las dos partes tengan el mismo carácter', () => {
    // Alguien demanda y alguien es demandado.
    const c = leerCaptura(campos({ contraparteRol: 'actor' }))
    expect(
      validarCaptura(c).some((p) => /mismo carácter/.test(p.mensaje)),
    ).toBe(true)
  })

  it('no exige contraparte', () => {
    const c = leerCaptura(campos({ contraparteNombre: '', contraparteRol: '' }))
    expect(validarCaptura(c)).toEqual([])
  })
})

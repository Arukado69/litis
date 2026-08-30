import { describe, expect, it } from 'vitest'

import {
  clonarEtapas,
  etapaInicial,
  prepararApertura,
  validarApertura,
  type DatosApertura,
  type ParteCaptura,
} from './apertura'

function parte(over: Partial<ParteCaptura> = {}): ParteCaptura {
  return {
    personaId: 'per-1',
    nombre: 'Juan Pérez',
    rol: 'actor',
    esNuestraParte: true,
    ...over,
  }
}

function datos(over: Partial<DatosApertura> = {}): DatosApertura {
  return {
    despachoId: 'des-1',
    materia: 'mercantil',
    via: 'merc.ordinario',
    fuero: 'comun',
    partes: [
      parte(),
      parte({
        personaId: 'per-2',
        nombre: 'Constructora XYZ',
        rol: 'demandado',
        esNuestraParte: false,
      }),
    ],
    ...over,
  }
}

describe('clonarEtapas y etapaInicial', () => {
  it('copia la plantilla de la vía en orden', () => {
    const etapas = clonarEtapas('merc.ejecutivo')
    expect(etapas[0]?.clave).toBe('preparacion')
    expect(etapas.map((e) => e.orden)).toEqual(
      etapas.map((_, i) => i + 1),
    )
    expect(etapas.some((e) => e.clave === 'requerimiento_embargo')).toBe(true)
  })

  it('marca las etapas paralelas', () => {
    const etapas = clonarEtapas('amp.indirecto')
    const suspension = etapas.find((e) => e.clave === 'suspension_provisional')
    expect(suspension?.paralela).toBe(true)
  })

  it('el expediente nace en la primera etapa del hilo principal', () => {
    // Nunca en una paralela: un asunto no arranca en el incidente de suspensión.
    expect(etapaInicial(clonarEtapas('amp.indirecto'))).toBe('preparacion')
    expect(etapaInicial(clonarEtapas('lab.ordinario'))).toBe(
      'conciliacion_prejudicial',
    )
  })

  it('devuelve null si no hay ninguna etapa principal', () => {
    expect(etapaInicial([])).toBeNull()
  })
})

describe('validarApertura — lo que se bloquea', () => {
  it('acepta un alta bien formada', () => {
    expect(validarApertura(datos())).toEqual([])
  })

  it('bloquea una vía desconocida', () => {
    // Sin vía no hay régimen de cómputo y no se puede calcular un solo plazo.
    const problemas = validarApertura(datos({ via: 'inventada' }))
    expect(problemas[0]?.campo).toBe('via')
    expect(problemas[0]?.mensaje).toMatch(/no se pueden computar plazos/)
  })

  it('bloquea una vía que no corresponde a la materia', () => {
    const problemas = validarApertura(
      datos({ materia: 'laboral', via: 'merc.ordinario' }),
    )
    expect(problemas.some((p) => p.campo === 'via')).toBe(true)
  })

  it('bloquea un fuero imposible para la vía', () => {
    // El amparo solo existe en fuero federal.
    const problemas = validarApertura(
      datos({ materia: 'amparo', via: 'amp.indirecto', fuero: 'comun' }),
    )
    expect(problemas.some((p) => p.campo === 'fuero')).toBe(true)
  })

  it('bloquea si no hay exactamente una parte propia', () => {
    const sinPropia = validarApertura(
      datos({ partes: [parte({ esNuestraParte: false })] }),
    )
    expect(sinPropia.some((p) => p.campo === 'partes')).toBe(true)

    const dosPropias = validarApertura(
      datos({
        partes: [parte(), parte({ personaId: 'per-2', nombre: 'Otro' })],
      }),
    )
    expect(dosPropias.some((p) => /2 partes marcadas/.test(p.mensaje))).toBe(true)
  })

  it('bloquea una materia desconocida', () => {
    const problemas = validarApertura(
      datos({ materia: 'inventada' as never, via: 'merc.ordinario' }),
    )
    expect(problemas.some((p) => p.campo === 'materia')).toBe(true)
  })
})

describe('prepararApertura', () => {
  it('arma el plan completo', () => {
    const r = prepararApertura(datos())

    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.plan.expediente.etapaActual).toBe('preparacion')
    expect(r.plan.etapas.length).toBeGreaterThan(5)
    expect(r.plan.partes).toHaveLength(2)
  })

  it('arma la carátula con las partes si no se capturó', () => {
    const r = prepararApertura(datos())
    if (!r.ok) throw new Error('debió pasar la validación')

    expect(r.plan.expediente.caratula).toBe('Juan Pérez vs. Constructora XYZ')
  })

  it('respeta la carátula capturada a mano', () => {
    const r = prepararApertura(datos({ caratula: 'Asunto Torres — cobranza' }))
    if (!r.ok) throw new Error('debió pasar la validación')

    expect(r.plan.expediente.caratula).toBe('Asunto Torres — cobranza')
  })

  it('devuelve los problemas y ningún plan si el alta es inválida', () => {
    const r = prepararApertura(datos({ via: 'inventada' }))

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.problemas.length).toBeGreaterThan(0)
  })
})

describe('prepararApertura — advertencias que no bloquean', () => {
  it('deja pasar el alta sin número de órgano, pero lo dice', () => {
    // El número del juzgado no existe hasta que se admite la demanda.
    // Exigirlo obligaría a inventarlo.
    const r = prepararApertura(datos())
    if (!r.ok) throw new Error('no debió bloquear')

    expect(r.plan.expediente.numeroOrgano).toBeNull()
    expect(r.plan.advertencias.some((a) => /número de expediente/i.test(a))).toBe(
      true,
    )
  })

  it('advierte que sin responsable nadie recibirá los avisos de plazos', () => {
    const r = prepararApertura(datos())
    if (!r.ok) throw new Error('no debió bloquear')

    expect(r.plan.advertencias.some((a) => /responsable/i.test(a))).toBe(true)
  })

  it('advierte que sin órgano el calendario será el de por omisión', () => {
    const r = prepararApertura(datos())
    if (!r.ok) throw new Error('no debió bloquear')

    expect(r.plan.advertencias.some((a) => /calendario/i.test(a))).toBe(true)
  })

  it('no advierte de lo que sí se capturó', () => {
    const r = prepararApertura(
      datos({
        organoId: 'org-1',
        numeroOrgano: '123/2026',
        responsableId: 'perf-1',
        clientePersonaId: 'per-1',
      }),
    )
    if (!r.ok) throw new Error('no debió bloquear')

    expect(r.plan.advertencias).toEqual([])
  })
})

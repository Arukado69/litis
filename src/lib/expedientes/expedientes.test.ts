import { describe, expect, it } from 'vitest'

import {
  ETAPAS_GENERICAS,
  avance,
  etapasDeVia,
  etapasPrincipales,
  tienePlantillaPropia,
} from './etapas'
import {
  LISTA_MATERIAS,
  VIAS,
  buscarVia,
  regimenDeVia,
  viasDeMateria,
} from './materias'
import {
  ROLES_POR_MATERIA,
  caratula,
  contrapartes,
  nuestraParte,
  validarPartes,
  type Parte,
} from './partes'

function parte(over: Partial<Parte> = {}): Parte {
  return {
    id: 'p1',
    expedienteId: 'e1',
    rol: 'actor',
    tipoPersona: 'fisica',
    nombre: 'Juan Pérez',
    rfc: null,
    curp: null,
    abogadoContrario: null,
    esNuestraParte: true,
    notas: null,
    ...over,
  }
}

describe('materias y vías', () => {
  it('toda vía apunta a una materia que existe', () => {
    const ids = new Set(LISTA_MATERIAS.map((m) => m.id))
    for (const via of VIAS) {
      expect(ids.has(via.materia), `${via.id} apunta a ${via.materia}`).toBe(true)
    }
  })

  it('no hay ids de vía repetidos', () => {
    const ids = VIAS.map((v) => v.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toda vía declara al menos un fuero', () => {
    for (const via of VIAS) {
      expect(via.fueros.length, `${via.id} sin fuero`).toBeGreaterThan(0)
    }
  })

  it('el amparo solo existe en el fuero federal', () => {
    for (const via of viasDeMateria('amparo')) {
      expect(via.fueros).toEqual(['federal'])
    }
  })

  it('resuelve el régimen de cómputo de una vía', () => {
    expect(regimenDeVia('merc.ejecutivo')).toBe('mercantil')
    expect(regimenDeVia('amp.indirecto')).toBe('amparo')
    expect(regimenDeVia('adm.nulidad_sumaria')).toBe('contencioso_administrativo')
  })

  it('falla ruidosamente ante una vía desconocida', () => {
    // Adivinar el régimen sería peor que no computar: daría una fecha falsa
    // con apariencia de correcta.
    expect(() => regimenDeVia('no.existe')).toThrow(RangeError)
    expect(buscarVia('no.existe')).toBeNull()
  })
})

describe('etapas por vía', () => {
  it('el ejecutivo mercantil embarga antes de emplazar', () => {
    // Es lo que lo distingue del ordinario. Si el tablero no lo refleja, el
    // ejecutivo se sigue como si fuera ordinario y se pierde la diligencia.
    const etapas = etapasDeVia('merc.ejecutivo').map((e) => e.id)
    expect(etapas).toContain('requerimiento_embargo')
    expect(etapas.indexOf('requerimiento_embargo')).toBeLessThan(
      etapas.indexOf('contestacion'),
    )
  })

  it('el ordinario mercantil no tiene etapa de embargo', () => {
    const etapas = etapasDeVia('merc.ordinario').map((e) => e.id)
    expect(etapas).not.toContain('requerimiento_embargo')
  })

  it('la suspensión en amparo es paralela, no una posición del avance', () => {
    const todas = etapasDeVia('amp.indirecto').map((e) => e.id)
    const principales = etapasPrincipales('amp.indirecto').map((e) => e.id)

    expect(todas).toContain('suspension_provisional')
    expect(principales).not.toContain('suspension_provisional')
    expect(principales).not.toContain('suspension_definitiva')
  })

  it('la conciliación prejudicial abre el flujo laboral', () => {
    expect(etapasDeVia('lab.ordinario')[0]?.id).toBe('conciliacion_prejudicial')
  })

  it('el asunto consultivo no finge ser un juicio', () => {
    const etapas = etapasDeVia('corp.asunto').map((e) => e.id)
    expect(etapas).not.toContain('sentencia')
    expect(etapas).toContain('entrega')
  })

  it('cae en la plantilla genérica si la vía no tiene una propia', () => {
    expect(tienePlantillaPropia('inventada')).toBe(false)
    expect(etapasDeVia('inventada')).toBe(ETAPAS_GENERICAS)
  })

  it('no hay ids de etapa repetidos dentro de una vía', () => {
    for (const via of VIAS) {
      const ids = etapasDeVia(via.id).map((e) => e.id)
      expect(new Set(ids).size, `${via.id} tiene etapas repetidas`).toBe(
        ids.length,
      )
    }
  })
})

describe('avance', () => {
  it('crece conforme avanza el hilo principal', () => {
    const inicio = avance('merc.ordinario', 'preparacion')
    const medio = avance('merc.ordinario', 'sentencia')
    const fin = avance('merc.ordinario', 'ejecucion')

    expect(inicio).toBeGreaterThan(0)
    expect(medio).toBeGreaterThan(inicio)
    expect(fin).toBe(1)
  })

  it('una etapa desconocida no rompe la barra', () => {
    expect(avance('merc.ordinario', 'inventada')).toBe(0)
  })

  it('una etapa paralela no cuenta como avance', () => {
    expect(avance('amp.indirecto', 'suspension_provisional')).toBe(0)
  })
})

describe('partes', () => {
  it('cada materia ofrece sus propios roles', () => {
    expect(ROLES_POR_MATERIA.amparo).toContain('quejoso')
    expect(ROLES_POR_MATERIA.amparo).not.toContain('trabajador')
    expect(ROLES_POR_MATERIA.laboral).toContain('patron')
    expect(ROLES_POR_MATERIA.penal).toContain('imputado')
  })

  it('exige exactamente una parte propia', () => {
    expect(validarPartes([])).toHaveLength(1)

    const sinPropia = validarPartes([parte({ esNuestraParte: false })])
    expect(sinPropia[0]?.mensaje).toMatch(/Ninguna parte está marcada/)

    const dosPropias = validarPartes([
      parte({ id: 'a' }),
      parte({ id: 'b', nombre: 'María López' }),
    ])
    expect(dosPropias[0]?.mensaje).toMatch(/2 partes marcadas como propias/)
  })

  it('detecta partes sin nombre', () => {
    const problemas = validarPartes([
      parte(),
      parte({ id: 'b', nombre: '   ', esNuestraParte: false }),
    ])
    expect(problemas.some((p) => /sin nombre/.test(p.mensaje))).toBe(true)
  })

  it('un expediente bien capturado no tiene problemas', () => {
    expect(
      validarPartes([
        parte(),
        parte({
          id: 'b',
          nombre: 'Constructora XYZ',
          rol: 'demandado',
          esNuestraParte: false,
        }),
      ]),
    ).toEqual([])
  })

  it('arma la carátula al estilo del foro', () => {
    const partes = [
      parte(),
      parte({
        id: 'b',
        nombre: 'Constructora XYZ',
        rol: 'demandado',
        esNuestraParte: false,
      }),
    ]

    expect(caratula(partes)).toBe('Juan Pérez vs. Constructora XYZ')
    expect(nuestraParte(partes)?.nombre).toBe('Juan Pérez')
    expect(contrapartes(partes).map((p) => p.nombre)).toEqual([
      'Constructora XYZ',
    ])
  })

  it('la carátula degrada sin romperse', () => {
    expect(caratula([])).toBe('Sin partes capturadas')
    expect(caratula([parte()])).toBe('Juan Pérez')
  })
})

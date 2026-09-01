import { describe, expect, it } from 'vitest'

import { etapasDeVia } from '@/lib/expedientes/etapas'
import { VIAS } from '@/lib/expedientes/materias'

import {
  DIAS_PARA_ESTANCADO,
  FASES,
  armarTablero,
  diasSinMoverse,
  estancados,
  faseDeEtapa,
  type ExpedienteEnTablero,
} from './fases'

const HOY = '2026-09-03'

function exp(over: Partial<ExpedienteEnTablero> = {}): ExpedienteEnTablero {
  return {
    id: 'e1',
    numeroInterno: 'INT-2026-001',
    numeroOrgano: '431/2026',
    caratula: 'Pérez vs. Constructora XYZ',
    via: 'merc.ordinario',
    viaNombre: 'Ordinario mercantil',
    etapaClave: 'contestacion',
    etapaNombre: 'Contestación',
    estado: 'activo',
    responsableNombre: 'Danny Salas',
    paralelas: [],
    plazosVivos: 0,
    proximoVencimiento: null,
    actualizadoEl: '2026-09-01T10:00:00Z',
    ...over,
  }
}

describe('faseDeEtapa', () => {
  it('coloca las etapas típicas donde toca', () => {
    expect(faseDeEtapa('merc.ordinario', 'preparacion')).toBe('preparacion')
    expect(faseDeEtapa('merc.ordinario', 'demanda')).toBe('presentacion')
    expect(faseDeEtapa('merc.ordinario', 'pruebas_desahogo')).toBe('instruccion')
    expect(faseDeEtapa('merc.ordinario', 'sentencia')).toBe('resolucion')
    expect(faseDeEtapa('merc.ordinario', 'apelacion')).toBe('impugnacion')
    expect(faseDeEtapa('merc.ordinario', 'ejecucion')).toBe('ejecucion')
  })

  it('sin etapa no hay fase', () => {
    expect(faseDeEtapa('merc.ordinario', null)).toBeNull()
  })

  it('una etapa desconocida no se inventa una fase', () => {
    // Pasa con etapas capturadas a mano. Mejor que caiga en "sin fase" a que
    // aparezca en una columna equivocada.
    expect(faseDeEtapa('merc.ordinario', 'lo_que_sea')).toBeNull()
  })

  it('⚠️ "revisión" en amparo es impugnación', () => {
    expect(faseDeEtapa('amp.indirecto', 'revision')).toBe('impugnacion')
  })

  it('⚠️ "revisión" en corporativo NO es impugnación', () => {
    // Es revisar el documento antes de entregarlo. Sin la excepción, un
    // dictamen a punto de entregarse aparecería entre las impugnaciones.
    expect(faseDeEtapa('corp.asunto', 'revision')).toBe('resolucion')
  })

  it('las cuatro secciones de un sucesorio caen en instrucción', () => {
    for (const s of ['seccion_primera', 'seccion_segunda', 'seccion_tercera', 'seccion_cuarta']) {
      expect(faseDeEtapa('civ.sucesorio', s)).toBe('instruccion')
    }
  })
})

describe('el mapa cubre TODAS las etapas del catálogo', () => {
  // Es la prueba que importa de este archivo: si mañana alguien agrega una
  // etapa a una plantilla y no la mapea, los expedientes que lleguen ahí se
  // caen del tablero en silencio. Aquí se entera al correr las pruebas.
  it('ninguna etapa de ninguna vía se queda sin fase', () => {
    const huerfanas: string[] = []

    for (const via of VIAS) {
      for (const etapa of etapasDeVia(via.id)) {
        if (etapa.paralela) continue
        if (faseDeEtapa(via.id, etapa.id) === null) {
          huerfanas.push(`${via.id}:${etapa.id}`)
        }
      }
    }

    expect(huerfanas).toEqual([])
  })

  it('cada fase declarada tiene nombre y descripción', () => {
    for (const f of FASES) {
      expect(f.nombre.length).toBeGreaterThan(0)
      expect(f.descripcion.length).toBeGreaterThan(0)
    }
  })
})

describe('armarTablero', () => {
  it('reparte cada expediente en su columna', () => {
    const tablero = armarTablero([
      exp({ id: 'a', etapaClave: 'demanda' }),
      exp({ id: 'b', etapaClave: 'sentencia' }),
    ])
    const porFase = new Map(tablero.columnas.map((c) => [c.fase.id, c.expedientes]))
    expect(porFase.get('presentacion')?.[0]?.id).toBe('a')
    expect(porFase.get('resolucion')?.[0]?.id).toBe('b')
  })

  it('devuelve TODAS las columnas, también las vacías', () => {
    // Una columna vacía es información: dice que no hay nada en apelación.
    expect(armarTablero([]).columnas).toHaveLength(FASES.length)
  })

  it('los sin etapa van APARTE, no escondidos en Preparación', () => {
    // "No sé en qué va" es un estado real del despacho, y meterlo en una
    // columna legítima lo vuelve invisible justo cuando hay que arreglarlo.
    const tablero = armarTablero([exp({ id: 'x', etapaClave: null })])
    expect(tablero.sinEtapa.map((e) => e.id)).toEqual(['x'])
    const preparacion = tablero.columnas.find((c) => c.fase.id === 'preparacion')
    expect(preparacion?.expedientes).toEqual([])
  })

  it('una etapa que el mapa no conoce cae en "sin fase", no en una columna al azar', () => {
    const tablero = armarTablero([exp({ id: 'y', etapaClave: 'etapa_local_rara' })])
    expect(tablero.sinFase.map((e) => e.id)).toEqual(['y'])
  })

  it('cuenta el total, incluidos los apartados', () => {
    const tablero = armarTablero([
      exp({ id: 'a' }),
      exp({ id: 'b', etapaClave: null }),
      exp({ id: 'c', etapaClave: 'rara' }),
    ])
    expect(tablero.total).toBe(3)
  })
})

describe('el orden dentro de la columna', () => {
  it('primero lo que tiene vencimiento más cercano', () => {
    const tablero = armarTablero([
      exp({ id: 'lejos', proximoVencimiento: '2026-10-01', plazosVivos: 1 }),
      exp({ id: 'cerca', proximoVencimiento: '2026-09-05', plazosVivos: 1 }),
    ])
    const columna = tablero.columnas.find((c) => c.fase.id === 'instruccion')
    expect(columna?.expedientes.map((e) => e.id)).toEqual(['cerca', 'lejos'])
  })

  it('lo que tiene plazo va antes que lo que no', () => {
    const tablero = armarTablero([
      exp({ id: 'tranquilo', proximoVencimiento: null }),
      exp({ id: 'aprieta', proximoVencimiento: '2026-12-01', plazosVivos: 1 }),
    ])
    const columna = tablero.columnas.find((c) => c.fase.id === 'instruccion')
    expect(columna?.expedientes[0]?.id).toBe('aprieta')
  })

  it('entre los tranquilos, primero el que lleva más sin moverse', () => {
    // Ese es el que se está durmiendo.
    const tablero = armarTablero([
      exp({ id: 'reciente', actualizadoEl: '2026-09-01T00:00:00Z' }),
      exp({ id: 'viejo', actualizadoEl: '2026-03-01T00:00:00Z' }),
    ])
    const columna = tablero.columnas.find((c) => c.fase.id === 'instruccion')
    expect(columna?.expedientes.map((e) => e.id)).toEqual(['viejo', 'reciente'])
  })
})

describe('diasSinMoverse', () => {
  it('cuenta días naturales desde la última actualización', () => {
    expect(diasSinMoverse(exp({ actualizadoEl: '2026-08-31T23:00:00Z' }), HOY)).toBe(3)
  })

  it('actualizado hoy es cero', () => {
    expect(diasSinMoverse(exp({ actualizadoEl: `${HOY}T08:00:00Z` }), HOY)).toBe(0)
  })

  it('una fecha futura no da negativo', () => {
    expect(diasSinMoverse(exp({ actualizadoEl: '2026-12-01T00:00:00Z' }), HOY)).toBe(0)
  })
})

describe('estancados', () => {
  const viejo = '2026-01-01T00:00:00Z'

  it('marca lo que lleva mucho sin moverse y sin plazos', () => {
    const lista = estancados([exp({ id: 'dormido', actualizadoEl: viejo })], HOY)
    expect(lista.map((e) => e.id)).toEqual(['dormido'])
  })

  it('⚠️ un asunto con un plazo corriendo NO está estancado', () => {
    // Está esperando, que es distinto. El que preocupa es el que no tiene nada
    // corriendo y nadie ha tocado: ese es el que se cae por caducidad.
    expect(
      estancados([exp({ actualizadoEl: viejo, plazosVivos: 1 })], HOY),
    ).toEqual([])
  })

  it('lo movido hace poco tampoco', () => {
    expect(
      estancados([exp({ actualizadoEl: '2026-09-01T00:00:00Z' })], HOY),
    ).toEqual([])
  })

  it('justo en el umbral ya cuenta', () => {
    const fecha = new Date(
      Date.parse(`${HOY}T00:00:00Z`) - DIAS_PARA_ESTANCADO * 86_400_000,
    ).toISOString()
    expect(estancados([exp({ actualizadoEl: fecha })], HOY)).toHaveLength(1)
  })

  it('el más dormido va primero', () => {
    const lista = estancados(
      [
        exp({ id: 'menos', actualizadoEl: '2026-05-01T00:00:00Z' }),
        exp({ id: 'mas', actualizadoEl: '2026-01-01T00:00:00Z' }),
      ],
      HOY,
    )
    expect(lista.map((e) => e.id)).toEqual(['mas', 'menos'])
  })
})

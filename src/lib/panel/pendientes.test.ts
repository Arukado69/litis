import { describe, expect, it } from 'vitest'

import { CALENDARIO_PJF_2026 } from '@/lib/plazos/calendarios-semilla'

import {
  armarPanel,
  urgenciaPara,
  type AudienciaDelPanel,
  type PlazoDelPanel,
} from './pendientes'

const PJF = CALENDARIO_PJF_2026

/** Viernes. Al lunes 16 le queda 1 día hábil; al martes 17, dos. */
const HOY = '2026-03-13'

function plazo(over: Partial<PlazoDelPanel> = {}): PlazoDelPanel {
  return {
    id: 'pl-1',
    expedienteId: 'exp-1',
    numeroInterno: '2026-001',
    caratula: 'Pérez vs. Constructora XYZ',
    etiqueta: 'Contestación de demanda',
    fechaVencimiento: '2026-03-16',
    responsableId: 'ab-1',
    responsableNombre: 'Lic. Danny',
    confiabilidad: 'semilla_no_verificada',
    ...over,
  }
}

function audiencia(over: Partial<AudienciaDelPanel> = {}): AudienciaDelPanel {
  return {
    id: 'au-1',
    expedienteId: 'exp-2',
    numeroInterno: '2026-002',
    caratula: 'Torres vs. Banco',
    tipo: 'Audiencia preliminar',
    fecha: '2026-03-16',
    hora: '09:00',
    lugar: 'Juzgado Décimo Segundo',
    responsableId: 'ab-1',
    responsableNombre: 'Lic. Danny',
    ...over,
  }
}

function panel(over: {
  plazos?: PlazoDelPanel[]
  audiencias?: AudienciaDelPanel[]
  horizonteDias?: number
}) {
  return armarPanel({
    plazos: over.plazos ?? [],
    audiencias: over.audiencias ?? [],
    hoy: HOY,
    calendario: PJF,
    horizonteDias: over.horizonteDias,
  })
}

describe('urgenciaPara', () => {
  it('clasifica por días hábiles restantes', () => {
    expect(urgenciaPara(-1)).toBe('vencido')
    expect(urgenciaPara(0)).toBe('hoy')
    expect(urgenciaPara(1)).toBe('inminente')
    expect(urgenciaPara(2)).toBe('inminente')
    expect(urgenciaPara(3)).toBe('proximo')
  })
})

describe('armarPanel — plazos y audiencias en una sola lista', () => {
  it('junta los dos tipos', () => {
    const p = panel({ plazos: [plazo()], audiencias: [audiencia()] })

    expect(p.pendientes).toHaveLength(2)
    expect(p.pendientes.map((x) => x.tipo).sort()).toEqual(['audiencia', 'plazo'])
  })

  it('cuenta en días hábiles, no naturales', () => {
    // Del viernes al lunes hay 3 días de calendario y UN día de trabajo.
    const p = panel({ plazos: [plazo()] })
    expect(p.pendientes[0]?.diasHabiles).toBe(1)
    expect(p.pendientes[0]?.urgencia).toBe('inminente')
  })

  it('agrupa por urgencia', () => {
    const p = panel({
      plazos: [
        plazo({ id: 'vencido', fechaVencimiento: '2026-03-11' }),
        plazo({ id: 'hoy', fechaVencimiento: '2026-03-13' }),
        plazo({ id: 'inminente', fechaVencimiento: '2026-03-17' }),
        plazo({ id: 'proximo', fechaVencimiento: '2026-03-20' }),
      ],
    })

    expect(p.vencidos.map((x) => x.id)).toEqual(['vencido'])
    expect(p.hoy.map((x) => x.id)).toEqual(['hoy'])
    expect(p.inminentes.map((x) => x.id)).toEqual(['inminente'])
    expect(p.proximos.map((x) => x.id)).toEqual(['proximo'])
  })

  it('ordena lo más urgente primero', () => {
    const p = panel({
      plazos: [
        plazo({ id: 'lejano', fechaVencimiento: '2026-03-20' }),
        plazo({ id: 'vencido', fechaVencimiento: '2026-03-11' }),
        plazo({ id: 'manana', fechaVencimiento: '2026-03-16' }),
      ],
    })

    expect(p.pendientes.map((x) => x.id)).toEqual(['vencido', 'manana', 'lejano'])
  })

  it('a igual día, la audiencia va antes que el plazo', () => {
    // La audiencia tiene hora fija y no se mueve; el escrito se puede trabajar
    // de madrugada.
    const p = panel({ plazos: [plazo()], audiencias: [audiencia()] })
    expect(p.pendientes[0]?.tipo).toBe('audiencia')
  })

  it('propaga que el cómputo no está verificado', () => {
    const p = panel({ plazos: [plazo()] })
    expect(p.pendientes[0]?.confiabilidad).toBe('semilla_no_verificada')
  })
})

describe('armarPanel — horizonte', () => {
  it('deja fuera lo que está más allá del horizonte', () => {
    // Del 13 de marzo, el 30 queda a 11 días hábiles.
    const p = panel({ plazos: [plazo({ fechaVencimiento: '2026-03-30' })] })
    expect(p.pendientes).toHaveLength(0)
  })

  it('incluye justo el límite del horizonte', () => {
    // El 27 de marzo queda a exactamente 10.
    const p = panel({ plazos: [plazo({ fechaVencimiento: '2026-03-27' })] })
    expect(p.pendientes).toHaveLength(1)
  })

  it('lo vencido entra siempre, sin importar cuánto haga', () => {
    const p = panel({ plazos: [plazo({ fechaVencimiento: '2026-01-05' })] })
    expect(p.vencidos).toHaveLength(1)
  })

  it('respeta un horizonte más corto', () => {
    const p = panel({
      plazos: [plazo({ fechaVencimiento: '2026-03-20' })],
      horizonteDias: 2,
    })
    expect(p.pendientes).toHaveLength(0)
  })
})

describe('armarPanel — lo que no tiene dueño', () => {
  it('separa lo que no tiene responsable', () => {
    // Es lo más peligroso de la lista: nadie lo está viendo y por eso nadie lo
    // va a reclamar.
    const p = panel({
      plazos: [
        plazo({ id: 'con-dueno' }),
        plazo({ id: 'huerfano', responsableId: null, responsableNombre: null }),
      ],
    })

    expect(p.sinResponsable.map((x) => x.id)).toEqual(['huerfano'])
    // Sigue apareciendo en la lista general: no es una lista aparte, es un
    // resaltado.
    expect(p.pendientes).toHaveLength(2)
  })
})

describe('detectarChoques', () => {
  it('marca el día en que una persona tiene audiencia y vencimiento', () => {
    // El caso que arruina la semana.
    const p = panel({ plazos: [plazo()], audiencias: [audiencia()] })

    expect(p.choques).toHaveLength(1)
    expect(p.choques[0]?.fecha).toBe('2026-03-16')
    expect(p.choques[0]?.conAudiencia).toBe(true)
    expect(p.choques[0]?.compromisos).toHaveLength(2)
    expect(p.choques[0]?.responsableNombre).toBe('Lic. Danny')
  })

  it('marca también dos plazos el mismo día, sin audiencia', () => {
    const p = panel({
      plazos: [plazo({ id: 'a' }), plazo({ id: 'b', expedienteId: 'exp-9' })],
    })

    expect(p.choques).toHaveLength(1)
    expect(p.choques[0]?.conAudiencia).toBe(false)
  })

  it('no marca compromisos de personas distintas', () => {
    const p = panel({
      plazos: [plazo({ id: 'a' })],
      audiencias: [audiencia({ responsableId: 'ab-2', responsableNombre: 'Lic. Ana' })],
    })

    expect(p.choques).toEqual([])
  })

  it('no marca días distintos', () => {
    const p = panel({
      plazos: [plazo({ fechaVencimiento: '2026-03-16' })],
      audiencias: [audiencia({ fecha: '2026-03-17' })],
    })

    expect(p.choques).toEqual([])
  })

  it('no cruza lo que no tiene responsable', () => {
    // No se le puede achacar a nadie.
    const p = panel({
      plazos: [
        plazo({ id: 'a', responsableId: null }),
        plazo({ id: 'b', responsableId: null }),
      ],
    })

    expect(p.choques).toEqual([])
  })

  it('no avisa de choques que ya pasaron', () => {
    // Sirve de nada y ensucia la lista.
    const p = panel({
      plazos: [
        plazo({ id: 'a', fechaVencimiento: '2026-03-11' }),
        plazo({ id: 'b', fechaVencimiento: '2026-03-11' }),
      ],
    })

    expect(p.choques).toEqual([])
  })

  it('pone los graves primero y luego los más cercanos', () => {
    const p = panel({
      plazos: [
        plazo({ id: 'p1', fechaVencimiento: '2026-03-16' }),
        plazo({ id: 'p2', fechaVencimiento: '2026-03-16', expedienteId: 'x' }),
        plazo({ id: 'p3', fechaVencimiento: '2026-03-18' }),
        plazo({ id: 'p4', fechaVencimiento: '2026-03-18', expedienteId: 'y' }),
      ],
      audiencias: [audiencia({ fecha: '2026-03-18' })],
    })

    // El 18 tiene audiencia; el 16 solo dos plazos.
    expect(p.choques[0]?.fecha).toBe('2026-03-18')
    expect(p.choques[0]?.conAudiencia).toBe(true)
    expect(p.choques[1]?.fecha).toBe('2026-03-16')
  })
})

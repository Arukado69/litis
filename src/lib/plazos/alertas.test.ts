import { describe, expect, it } from 'vitest'

import {
  calcularAlertas,
  claveAlerta,
  diasHabilesRestantes,
  nivelPara,
  type PlazoVigilado,
} from './alertas'
import {
  CALENDARIO_LABORAL_2026,
  CALENDARIO_PJF_2026,
} from './calendarios-semilla'
import { CATALOGO_PLAZOS, buscarPlazo, idsDuplicados } from './catalogo'

const PJF = CALENDARIO_PJF_2026

function plazo(over: Partial<PlazoVigilado> = {}): PlazoVigilado {
  return {
    plazoId: 'p1',
    expedienteId: 'e1',
    calendarioId: null,
    numeroExpediente: 'INT-2026-001',
    caratula: 'Pérez vs. Constructora XYZ',
    etiqueta: 'Contestación de demanda',
    fechaVencimiento: '2026-03-16',
    responsableId: 'u1',
    responsableNombre: 'Lic. Danny',
    responsableEmail: 'danny@example.com',
    atendido: false,
    ...over,
  }
}

describe('diasHabilesRestantes', () => {
  it('devuelve 0 el día del vencimiento', () => {
    expect(diasHabilesRestantes('2026-03-16', '2026-03-16', PJF)).toBe(0)
  })

  it('cuenta solo días de trabajo, no días de calendario', () => {
    // Viernes 13 → lunes 16: son 3 días naturales pero UN solo día hábil.
    // Avisar "faltan 3" el viernes es avisar tarde.
    expect(diasHabilesRestantes('2026-03-13', '2026-03-16', PJF)).toBe(1)
  })

  it('el periodo vacacional colapsa una distancia larga a un solo día útil', () => {
    // Del 15 de julio al 3 de agosto hay 19 días naturales. Con las vacaciones
    // del órgano de por medio, queda UN día hábil. Este es exactamente el
    // escenario en el que un aviso en días naturales llega demasiado tarde.
    expect(diasHabilesRestantes('2026-07-15', '2026-08-03', PJF)).toBe(1)
  })

  it('es negativo cuando el plazo ya venció', () => {
    expect(diasHabilesRestantes('2026-03-17', '2026-03-16', PJF)).toBe(-1)
    expect(diasHabilesRestantes('2026-03-18', '2026-03-16', PJF)).toBe(-2)
  })

  it('cuenta correctamente a media distancia', () => {
    expect(diasHabilesRestantes('2026-03-09', '2026-03-16', PJF)).toBe(5)
    expect(diasHabilesRestantes('2026-03-11', '2026-03-16', PJF)).toBe(3)
  })
})

describe('nivelPara', () => {
  it('asigna el nivel de cada ventana', () => {
    expect(nivelPara(5)).toBe('t_menos_5')
    expect(nivelPara(4)).toBe('t_menos_5')
    expect(nivelPara(3)).toBe('t_menos_3')
    expect(nivelPara(2)).toBe('t_menos_3')
    expect(nivelPara(1)).toBe('t_menos_1')
    expect(nivelPara(0)).toBe('vence_hoy')
    expect(nivelPara(-1)).toBe('vencido')
    expect(nivelPara(-40)).toBe('vencido')
  })

  it('no alerta cuando todavía falta mucho', () => {
    expect(nivelPara(6)).toBeNull()
    expect(nivelPara(30)).toBeNull()
  })
})

describe('calcularAlertas', () => {
  const hoy = '2026-03-13' // viernes: al plazo del 16 le queda 1 día hábil

  it('genera la alerta que corresponde', () => {
    const alertas = calcularAlertas({
      plazos: [plazo()],
      yaEnviados: new Set(),
      hoy,
      calendarioPorOmision: PJF,
    })

    expect(alertas).toHaveLength(1)
    expect(alertas[0]?.nivel).toBe('t_menos_1')
    expect(alertas[0]?.diasRestantes).toBe(1)
  })

  it('no alerta sobre un plazo ya atendido', () => {
    const alertas = calcularAlertas({
      plazos: [plazo({ atendido: true })],
      yaEnviados: new Set(),
      hoy,
      calendarioPorOmision: PJF,
    })

    expect(alertas).toHaveLength(0)
  })

  it('no repite un nivel que ya se mandó', () => {
    const alertas = calcularAlertas({
      plazos: [plazo()],
      yaEnviados: new Set([claveAlerta('p1', 't_menos_1')]),
      hoy,
      calendarioPorOmision: PJF,
    })

    expect(alertas).toHaveLength(0)
  })

  it('sigue alertando el siguiente nivel aunque el anterior ya se mandara', () => {
    // Ya salió el de "faltan 3"; hoy toca el de "vence mañana".
    const alertas = calcularAlertas({
      plazos: [plazo()],
      yaEnviados: new Set([claveAlerta('p1', 't_menos_3')]),
      hoy,
      calendarioPorOmision: PJF,
    })

    expect(alertas.map((a) => a.nivel)).toEqual(['t_menos_1'])
  })

  it('ordena lo más urgente primero', () => {
    const alertas = calcularAlertas({
      plazos: [
        plazo({ plazoId: 'tranquilo', fechaVencimiento: '2026-03-20' }),
        plazo({ plazoId: 'vencido', fechaVencimiento: '2026-03-11' }),
        plazo({ plazoId: 'manana', fechaVencimiento: '2026-03-16' }),
      ],
      yaEnviados: new Set(),
      hoy,
      calendarioPorOmision: PJF,
    })

    expect(alertas.map((a) => a.plazo.plazoId)).toEqual([
      'vencido',
      'manana',
      'tranquilo',
    ])
  })

  it('omite los plazos que todavía están lejos', () => {
    const alertas = calcularAlertas({
      plazos: [plazo({ fechaVencimiento: '2026-06-30' })],
      yaEnviados: new Set(),
      hoy,
      calendarioPorOmision: PJF,
    })

    expect(alertas).toHaveLength(0)
  })
})

describe('catálogo de plazos', () => {
  it('no tiene ids repetidos', () => {
    expect(idsDuplicados()).toEqual([])
  })

  it('todo lo de fábrica nace sin verificar', () => {
    // Si alguna entrada llegara marcada como verificada, el producto estaría
    // afirmando algo que nadie del despacho revisó. Esa es justo la promesa
    // que no podemos hacer.
    const verificadas = CATALOGO_PLAZOS.filter(
      (p) => p.verificacion !== 'semilla_no_verificada',
    )
    expect(verificadas).toEqual([])
  })

  it('toda entrada cita fundamento y tiene duración válida', () => {
    for (const p of CATALOGO_PLAZOS) {
      expect(p.fundamento.trim().length, `${p.id} sin fundamento`).toBeGreaterThan(0)
      expect(Number.isInteger(p.dias), `${p.id} con días no entero`).toBe(true)
      expect(p.dias, `${p.id} con días inválidos`).toBeGreaterThanOrEqual(1)
      expect(p.etiqueta.trim().length, `${p.id} sin etiqueta`).toBeGreaterThan(0)
    }
  })

  it('los plazos con excepciones traen la advertencia a la vista', () => {
    // El recurso de queja no tiene un plazo uniforme; si el catálogo lo
    // presentara como un número seco, invitaría al error.
    expect(buscarPlazo('amp.queja')?.nota).toMatch(/no es uniforme/i)
  })

  it('encuentra y no inventa', () => {
    expect(buscarPlazo('merc.contestacion.ordinario')?.dias).toBe(15)
    expect(buscarPlazo('no.existe')).toBeNull()
  })
})

describe('calcularAlertas — cada plazo con su calendario', () => {
  it('un federal y uno local no se cuentan con el mismo', () => {
    // El PJF descansa del 16 de julio al 1 de agosto; el laboral no. Contar
    // los dos con el mismo calendario manda el aviso tarde en uno de ellos, y
    // esa es justo la falla que esta pieza existe para evitar.
    const federal = plazo({
      plazoId: 'federal',
      calendarioId: 'cal-pjf',
      fechaVencimiento: '2026-07-24',
    })
    const laboral = plazo({
      plazoId: 'laboral',
      calendarioId: 'cal-lab',
      fechaVencimiento: '2026-07-24',
    })

    const alertas = calcularAlertas({
      plazos: [federal, laboral],
      yaEnviados: new Set(),
      hoy: '2026-07-20',
      calendarios: new Map([
        ['cal-pjf', CALENDARIO_PJF_2026],
        ['cal-lab', CALENDARIO_LABORAL_2026],
      ]),
      calendarioPorOmision: CALENDARIO_PJF_2026,
    })

    const porId = new Map(alertas.map((a) => [a.plazo.plazoId, a]))
    // Para el federal no queda ningún día hábil de aquí al 24: está de
    // vacaciones, así que el vencimiento le cae encima.
    expect(porId.get('federal')?.diasRestantes).toBe(0)
    // Para el laboral hay una semana de trabajo entera.
    expect(porId.get('laboral')?.diasRestantes).toBe(4)
    expect(porId.get('laboral')?.nivel).toBe('t_menos_5')
  })

  it('un calendario que no está en el mapa cae al de por omisión', () => {
    const alertas = calcularAlertas({
      plazos: [plazo({ calendarioId: 'no-existe', fechaVencimiento: '2026-03-16' })],
      yaEnviados: new Set(),
      hoy: '2026-03-13',
      calendarios: new Map(),
      calendarioPorOmision: PJF,
    })
    expect(alertas).toHaveLength(1)
  })
})

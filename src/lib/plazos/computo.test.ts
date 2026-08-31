import { describe, expect, it } from 'vitest'

import {
  contarDiasHabiles,
  esHabil,
  evaluarDia,
  tramoDeDias,
} from './calendario'
import {
  CALENDARIO_LABORAL_2026,
  CALENDARIO_PJF_2026,
  calendarioBase,
} from './calendarios-semilla'
import { computarPlazo, resumenComputo } from './computo'
import { diaDeLaSemana, esFechaISO, sumarDias } from './fecha'

const PJF = CALENDARIO_PJF_2026
const LABORAL = CALENDARIO_LABORAL_2026

describe('fecha — aritmética civil sin husos', () => {
  it('rechaza fechas que no existen', () => {
    expect(esFechaISO('2026-02-30')).toBe(false)
    expect(esFechaISO('2026-13-01')).toBe(false)
    expect(esFechaISO('2026-3-1')).toBe(false)
    expect(esFechaISO('2026-02-28')).toBe(true)
  })

  it('acepta el 29 de febrero solo en año bisiesto', () => {
    expect(esFechaISO('2028-02-29')).toBe(true)
    expect(esFechaISO('2026-02-29')).toBe(false)
  })

  it('cruza fin de mes y fin de año sin correrse un día', () => {
    expect(sumarDias('2026-01-31', 1)).toBe('2026-02-01')
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01')
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('calcula el día de la semana correcto', () => {
    expect(diaDeLaSemana('2026-03-02')).toBe(1) // lunes
    expect(diaDeLaSemana('2026-03-21')).toBe(6) // sábado
  })
})

describe('calendario — inhábiles y conteo', () => {
  it('marca fines de semana con su motivo', () => {
    const sabado = evaluarDia('2026-03-21', PJF)
    expect(sabado.inhabil).toBe(true)
    // El 21 de marzo es feriado del PJF Y sábado. Gana el fin de semana porque
    // se evalúa primero; lo que importa es que el día no se cuente.
    expect(sabado.motivo).toBe('fin_de_semana')
  })

  it('marca los periodos vacacionales completos', () => {
    expect(esHabil('2026-07-15', PJF)).toBe(true) // víspera
    expect(esHabil('2026-07-16', PJF)).toBe(false) // primer día de vacaciones
    expect(esHabil('2026-07-31', PJF)).toBe(false) // último día
    expect(evaluarDia('2026-07-20', PJF).motivo).toBe('vacaciones')
  })

  it('cuenta el día del vencimiento dentro del plazo', () => {
    // Un plazo de 1 día que arranca en día hábil vence ese mismo día.
    const uno = contarDiasHabiles('2026-03-04', 1, PJF)
    expect(uno.ultimoDia).toBe('2026-03-04')

    // Cinco días hábiles de lunes a viernes vencen el viernes, no el lunes.
    const cinco = contarDiasHabiles('2026-03-09', 5, PJF)
    expect(cinco.ultimoDia).toBe('2026-03-13')
  })

  it('arranca en el primer hábil si el primer día cae inhábil', () => {
    const conteo = contarDiasHabiles('2026-03-21', 1, PJF) // sábado
    expect(conteo.ultimoDia).toBe('2026-03-23') // lunes
  })

  it('exige una duración entera y positiva', () => {
    expect(() => contarDiasHabiles('2026-03-04', 0, PJF)).toThrow(RangeError)
    expect(() => contarDiasHabiles('2026-03-04', 1.5, PJF)).toThrow(RangeError)
  })

  it('falla con mensaje legible si el calendario deja todo inhábil', () => {
    const bloqueado = {
      ...calendarioBase('bloqueado', 'Todo inhábil', '2026-01-01', '2026-12-31'),
      periodos: [
        {
          desde: '2026-01-01',
          hasta: '2029-12-31',
          motivo: 'suspension' as const,
          descripcion: 'Capturado mal a propósito',
        },
      ],
    }
    expect(() => contarDiasHabiles('2026-03-04', 1, bloqueado)).toThrow(
      /no se completaron/i,
    )
  })
})

describe('computarPlazo — el doble salto de la notificación', () => {
  it('en mercantil pierde dos días entre notificación y primer día', () => {
    // Notificado el lunes: surte efectos el martes, corre desde el miércoles.
    // Este es EL error clásico: quien cuenta desde el lunes presenta tarde.
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02', // lunes
      dias: 9,
      calendario: PJF,
    })

    expect(r.fechaSurteEfectos).toBe('2026-03-03') // martes
    expect(r.primerDia).toBe('2026-03-04') // miércoles
    expect(r.fechaVencimiento).toBe('2026-03-16') // lunes
    expect(r.diasContados).toHaveLength(9)
    expect(r.diasContados[0]?.fecha).toBe('2026-03-04')
    expect(r.diasContados[8]?.fecha).toBe('2026-03-16')
  })

  it('en amparo por oficio surte efectos el mismo día: un solo salto', () => {
    const r = computarPlazo({
      regimen: 'amparo',
      tipoNotificacion: 'oficio',
      fechaNotificacion: '2026-03-02',
      dias: 10,
      calendario: PJF,
    })

    expect(r.fechaSurteEfectos).toBe('2026-03-02') // el mismo día
    expect(r.primerDia).toBe('2026-03-03')
    expect(r.fechaVencimiento).toBe('2026-03-16')
  })

  it('la misma notificación por lista corre un día después que por oficio', () => {
    const base = {
      regimen: 'amparo' as const,
      fechaNotificacion: '2026-03-02',
      dias: 10,
      calendario: PJF,
    }
    const porOficio = computarPlazo({ ...base, tipoNotificacion: 'oficio' })
    const porLista = computarPlazo({ ...base, tipoNotificacion: 'lista' })

    expect(porOficio.fechaVencimiento).toBe('2026-03-16')
    expect(porLista.fechaVencimiento).toBe('2026-03-17')
  })
})

describe('computarPlazo — el calendario mueve la fecha', () => {
  it('el mismo plazo vence distinto según el calendario del órgano', () => {
    // Idéntico en todo salvo el calendario. El tercer lunes de marzo (16) es
    // inhábil bajo el art. 74 LFT pero hábil para el PJF, que usa el 21.
    const entrada = {
      regimen: 'mercantil' as const,
      tipoNotificacion: 'personal' as const,
      fechaNotificacion: '2026-03-02',
      dias: 9,
    }

    const conPjf = computarPlazo({ ...entrada, calendario: PJF })
    const conLaboral = computarPlazo({ ...entrada, calendario: LABORAL })

    expect(conPjf.fechaVencimiento).toBe('2026-03-16')
    expect(conLaboral.fechaVencimiento).toBe('2026-03-17')
  })

  it('salta el periodo vacacional completo', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-07-08', // miércoles, antes de vacaciones
      dias: 9,
      calendario: PJF,
    })

    expect(r.primerDia).toBe('2026-07-10')
    // Se cuentan 10, 13, 14 y 15 de julio; el resto cae en vacaciones y
    // fin de semana hasta el 3 de agosto.
    expect(r.fechaVencimiento).toBe('2026-08-07')
    expect(r.diasOmitidos.some((d) => d.motivo === 'vacaciones')).toBe(true)
  })
})

describe('computarPlazo — días naturales', () => {
  it('corren corridos, incluidos sábados y domingos', () => {
    const r = computarPlazo({
      regimen: 'penal_acusatorio',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 10,
      calendario: PJF,
    })

    expect(r.unidad).toBe('naturales')
    expect(r.primerDia).toBe('2026-03-03')
    expect(r.fechaVencimiento).toBe('2026-03-12')
    expect(r.diasContados).toHaveLength(0) // el detalle día a día es de hábiles
  })

  it('recorre el vencimiento si cae en día inhábil', () => {
    const r = computarPlazo({
      regimen: 'penal_acusatorio',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 12, // cae en sábado 14
      calendario: PJF,
    })

    expect(r.fechaVencimiento).toBe('2026-03-16') // lunes
    expect(r.pasos.some((p) => p.titulo.includes('Recorrido'))).toBe(true)
  })

  it('respeta la opción de no recorrer', () => {
    const r = computarPlazo({
      regimen: 'penal_acusatorio',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 12,
      calendario: PJF,
      recorrerVencimientoInhabil: false,
    })

    expect(r.fechaVencimiento).toBe('2026-03-14') // sábado, sin recorrer
  })
})

describe('computarPlazo — término de la distancia', () => {
  it('suma los días y lo deja asentado en las advertencias', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 9,
      diasPorDistancia: 3,
      calendario: PJF,
    })

    expect(r.diasDelPlazo).toBe(12)
    expect(r.fechaVencimiento).toBe('2026-03-19')
    expect(r.advertencias.some((a) => /distancia/i.test(a))).toBe(true)
  })

  it('rechaza un término de la distancia negativo', () => {
    expect(() =>
      computarPlazo({
        regimen: 'mercantil',
        tipoNotificacion: 'personal',
        fechaNotificacion: '2026-03-02',
        dias: 9,
        diasPorDistancia: -1,
        calendario: PJF,
      }),
    ).toThrow(RangeError)
  })
})

describe('computarPlazo — honestidad sobre lo que no sabe', () => {
  it('avisa cuando el plazo se sale de la vigencia del calendario', () => {
    // El calendario solo cubre 2026; el plazo aterriza en enero de 2027, donde
    // no sabemos qué días son inhábiles.
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-12-10',
      dias: 9,
      calendario: PJF,
    })

    expect(r.fechaVencimiento).toBe('2027-01-11')
    expect(r.coberturaCompleta).toBe(false)
    expect(r.advertencias.some((a) => /calendario/i.test(a))).toBe(true)
  })

  it('marca todo cómputo apoyado en catálogo de fábrica', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 9,
      calendario: PJF,
    })

    expect(r.confiabilidad).toBe('semilla_no_verificada')
    expect(r.advertencias.some((a) => /no verificado/i.test(a))).toBe(true)
  })

  it('no sube a verificado si solo el plazo lo está y el régimen no', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 9,
      calendario: PJF,
      verificacionPlazo: 'verificado_por_despacho',
    })

    // El régimen sigue siendo semilla: la cadena vale su eslabón más débil.
    expect(r.confiabilidad).toBe('semilla_no_verificada')
  })

  it('nunca afirma; describe un cómputo sugerido', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 9,
      calendario: PJF,
    })

    expect(resumenComputo(r)).toMatch(/^Cómputo sugerido:/)
  })
})

describe('computarPlazo — la traza es auditable', () => {
  it('entrega los pasos en orden y con fechas coherentes', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'personal',
      fechaNotificacion: '2026-03-02',
      dias: 9,
      calendario: PJF,
      etiqueta: 'Contestación de demanda',
    })

    const ordenes = r.pasos.map((p) => p.orden)
    expect(ordenes).toEqual([...ordenes].sort((a, b) => a - b))

    expect(r.pasos[0]?.fecha).toBe(r.fechaNotificacion)
    expect(r.pasos[0]?.detalle).toContain('Contestación de demanda')
    expect(r.pasos[1]?.fecha).toBe(r.fechaSurteEfectos)
    expect(r.pasos[2]?.fecha).toBe(r.primerDia)
    expect(r.pasos.at(-1)?.fecha).toBe(r.fechaVencimiento)

    // Todo cómputo cita al menos el fundamento del arranque.
    expect(r.fundamentos.length).toBeGreaterThan(0)
  })

  it('el orden temporal siempre se respeta', () => {
    const r = computarPlazo({
      regimen: 'mercantil',
      tipoNotificacion: 'lista',
      fechaNotificacion: '2026-03-02',
      dias: 15,
      calendario: PJF,
    })

    expect(r.fechaNotificacion <= r.fechaSurteEfectos).toBe(true)
    expect(r.fechaSurteEfectos < r.primerDia).toBe(true)
    expect(r.primerDia <= r.fechaVencimiento).toBe(true)
  })
})

describe('computarPlazo — validación de entrada', () => {
  it('rechaza fecha inválida, duración inválida y régimen desconocido', () => {
    const base = {
      regimen: 'mercantil' as const,
      tipoNotificacion: 'personal' as const,
      fechaNotificacion: '2026-03-02',
      dias: 9,
      calendario: PJF,
    }

    expect(() =>
      computarPlazo({ ...base, fechaNotificacion: '02/03/2026' }),
    ).toThrow(TypeError)
    expect(() => computarPlazo({ ...base, dias: 0 })).toThrow(RangeError)
    expect(() =>
      // Se fuerza el tipo a propósito: simula un valor sucio de la base.
      computarPlazo({ ...base, regimen: 'inventado' as never }),
    ).toThrow(RangeError)
  })
})

describe('tramoDeDias — la cinta de días', () => {
  it('marca cada día natural como hábil o inhábil', () => {
    // Del jueves 12 al lunes 16 de marzo de 2026: J V S D L.
    const tramo = tramoDeDias('2026-03-12', '2026-03-16', CALENDARIO_PJF_2026)
    expect(tramo.map((d) => d.habil)).toEqual([true, true, false, false, true])
  })

  it('incluye los dos extremos', () => {
    const tramo = tramoDeDias('2026-03-12', '2026-03-16', CALENDARIO_PJF_2026)
    expect(tramo[0]?.fecha).toBe('2026-03-12')
    expect(tramo.at(-1)?.fecha).toBe('2026-03-16')
  })

  it('un solo día es una cinta de una celda', () => {
    expect(tramoDeDias('2026-03-12', '2026-03-12', CALENDARIO_PJF_2026)).toHaveLength(1)
  })

  it('un plazo ya vencido no tiene cuenta regresiva', () => {
    // No es un caso raro: es la mitad del panel un lunes por la mañana.
    expect(tramoDeDias('2026-03-16', '2026-03-12', CALENDARIO_PJF_2026)).toEqual([])
  })

  it('enseña el hueco de las vacaciones judiciales', () => {
    // Esto es para lo que existe la cinta: veinte celdas y solo dos sólidas
    // —hoy y el día del vencimiento—, porque en medio el órgano está de
    // vacaciones. "Faltan veinte días" y "queda un día de trabajo" son la
    // misma situación, y solo una de las dos frases es útil.
    const tramo = tramoDeDias('2026-07-15', '2026-08-03', CALENDARIO_PJF_2026)
    expect(tramo).toHaveLength(20)
    expect(tramo.filter((d) => d.habil).map((d) => d.fecha)).toEqual([
      '2026-07-15',
      '2026-08-03',
    ])
  })

  it('se corta en el tope en vez de pintar doscientas celdas', () => {
    const tramo = tramoDeDias('2026-01-01', '2026-12-31', CALENDARIO_PJF_2026, 30)
    expect(tramo).toHaveLength(30)
  })
})

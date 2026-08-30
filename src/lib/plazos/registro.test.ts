import { describe, expect, it } from 'vitest'

import {
  advertenciasDelRegistro,
  leerEntero,
  leerNotificacion,
  resolverPlazo,
  validarNotificacion,
  type CapturaNotificacion,
  type EntradaCatalogo,
} from './registro'

const HOY = '2026-03-16'

function campos(over: Record<string, string> = {}): Record<string, string> {
  return {
    tipoNotificacion: 'personal',
    fechaNotificacion: '2026-03-02',
    plazoCatalogoClave: 'merc.contestacion.ordinario',
    ...over,
  }
}

function captura(over: Partial<CapturaNotificacion> = {}): CapturaNotificacion {
  return { ...leerNotificacion(campos()), ...over }
}

const CATALOGO: EntradaCatalogo[] = [
  {
    id: 'uuid-1',
    clave: 'merc.contestacion.ordinario',
    etiqueta: 'Contestación de demanda — juicio ordinario mercantil',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1378',
    verificado: false,
  },
]

describe('leerEntero', () => {
  it('acepta enteros no negativos', () => {
    expect(leerEntero('9')).toBe(9)
    expect(leerEntero(' 0 ')).toBe(0)
  })

  it('rechaza lo demás en vez de redondear', () => {
    expect(leerEntero('9.5')).toBeNull()
    expect(leerEntero('-3')).toBeNull()
    expect(leerEntero('nueve')).toBeNull()
    expect(leerEntero('')).toBeNull()
    expect(leerEntero(undefined)).toBeNull()
  })
})

describe('leerNotificacion', () => {
  it('lee la captura del catálogo', () => {
    const c = leerNotificacion(campos())
    expect(c.tipoNotificacion).toBe('personal')
    expect(c.fechaNotificacion).toBe('2026-03-02')
    expect(c.plazoCatalogoClave).toBe('merc.contestacion.ordinario')
    expect(c.diasDistancia).toBe(0)
  })

  it('lee un plazo capturado a mano', () => {
    const c = leerNotificacion(
      campos({
        plazoCatalogoClave: '',
        etiquetaManual: 'Desahogo de prevención',
        diasManual: '3',
        unidadManual: 'habiles',
      }),
    )
    expect(c.plazoCatalogoClave).toBeNull()
    expect(c.etiquetaManual).toBe('Desahogo de prevención')
    expect(c.diasManual).toBe(3)
  })

  it('un tipo de notificación desconocido cae en personal', () => {
    expect(leerNotificacion(campos({ tipoNotificacion: 'inventado' })).tipoNotificacion).toBe(
      'personal',
    )
  })

  it('una fecha mal formada queda en null, no adivinada', () => {
    expect(
      leerNotificacion(campos({ fechaNotificacion: '02/03/2026' })).fechaNotificacion,
    ).toBeNull()
  })
})

describe('validarNotificacion', () => {
  it('acepta una captura del catálogo', () => {
    expect(validarNotificacion(captura(), HOY)).toEqual([])
  })

  it('exige la fecha de la notificación', () => {
    const c = captura({ fechaNotificacion: null })
    expect(
      validarNotificacion(c, HOY).some((p) => p.campo === 'fechaNotificacion'),
    ).toBe(true)
  })

  it('rechaza una notificación del futuro', () => {
    const c = captura({ fechaNotificacion: '2026-04-01' })
    expect(
      validarNotificacion(c, HOY).some((p) => /futura/.test(p.mensaje)),
    ).toBe(true)
  })

  it('acepta capturar el pasado reciente', () => {
    // Se registra el lunes lo que llegó el viernes; eso es normal.
    expect(validarNotificacion(captura({ fechaNotificacion: '2026-03-02' }), HOY)).toEqual(
      [],
    )
  })

  it('sospecha de una fecha de hace más de un año', () => {
    // Casi siempre es el año mal tecleado, y eso produce un plazo vencido
    // hace meses que llena el panel de rojo falso.
    const c = captura({ fechaNotificacion: '2024-03-02' })
    expect(
      validarNotificacion(c, HOY).some((p) => /más de un año/.test(p.mensaje)),
    ).toBe(true)
  })

  it('exige nombre y días cuando el plazo es a mano', () => {
    const c = captura({ plazoCatalogoClave: null })
    const problemas = validarNotificacion(c, HOY)
    expect(problemas.some((p) => p.campo === 'etiquetaManual')).toBe(true)
    expect(problemas.some((p) => p.campo === 'diasManual')).toBe(true)
  })

  it('acepta un plazo a mano bien capturado', () => {
    const c = captura({
      plazoCatalogoClave: null,
      etiquetaManual: 'Desahogo de prevención',
      diasManual: 3,
    })
    expect(validarNotificacion(c, HOY)).toEqual([])
  })

  it('rechaza cero días en un plazo a mano', () => {
    const c = captura({
      plazoCatalogoClave: null,
      etiquetaManual: 'Algo',
      diasManual: 0,
    })
    expect(validarNotificacion(c, HOY).some((p) => p.campo === 'diasManual')).toBe(
      true,
    )
  })
})

describe('resolverPlazo', () => {
  it('toma los datos del catálogo', () => {
    const p = resolverPlazo(captura(), CATALOGO)
    expect(p.dias).toBe(15)
    expect(p.unidad).toBe('habiles')
    expect(p.fundamento).toBe('Código de Comercio, art. 1378')
    expect(p.catalogoId).toBe('uuid-1')
  })

  it('falla ruidosamente si la clave no existe', () => {
    // Computar con un plazo distinto del que el usuario creyó elegir sería
    // peor que no computar.
    expect(() =>
      resolverPlazo(captura({ plazoCatalogoClave: 'no.existe' }), CATALOGO),
    ).toThrow(RangeError)
  })

  it('usa lo capturado a mano cuando no hay catálogo', () => {
    const p = resolverPlazo(
      captura({
        plazoCatalogoClave: null,
        etiquetaManual: 'Desahogo de prevención',
        diasManual: 3,
        unidadManual: 'naturales',
      }),
      CATALOGO,
    )
    expect(p.etiqueta).toBe('Desahogo de prevención')
    expect(p.dias).toBe(3)
    expect(p.unidad).toBe('naturales')
    expect(p.fundamento).toBeNull()
    expect(p.catalogoId).toBeNull()
  })
})

describe('advertenciasDelRegistro', () => {
  it('avisa que un plazo a mano no tiene fundamento', () => {
    const c = captura({
      plazoCatalogoClave: null,
      etiquetaManual: 'X',
      diasManual: 3,
    })
    const p = resolverPlazo(c, CATALOGO)
    expect(
      advertenciasDelRegistro(c, p, 'mercantil').some((a) =>
        /a mano/.test(a),
      ),
    ).toBe(true)
  })

  it('no avisa de fundamento cuando viene del catálogo', () => {
    const c = captura()
    const p = resolverPlazo(c, CATALOGO)
    expect(
      advertenciasDelRegistro(c, p, 'mercantil').some((a) => /a mano/.test(a)),
    ).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import {
  avisoExtemporaneidad,
  detalleActuacion,
  esExtemporanea,
  estadoResultante,
  leerCierre,
  tipoActuacionDeCierre,
  tituloActuacion,
  validarCierre,
  type CapturaCierre,
  type ContextoCierre,
} from './cierre'

const CONTEXTO: ContextoCierre = {
  hoy: '2026-03-20',
  fechaVencimiento: '2026-03-16',
  fechaNotificacion: '2026-02-24',
}

function captura(over: Partial<CapturaCierre> = {}): CapturaCierre {
  return {
    accion: 'presentada',
    fechaPresentacion: '2026-03-13',
    descripcion: 'Contestación de demanda con acuse sellado.',
    motivo: null,
    reconoceExtemporanea: false,
    ...over,
  }
}

describe('leerCierre', () => {
  it('toma "presentada" cuando no se indica otra cosa', () => {
    // El cierre normal no debe depender de que el formulario mande la acción:
    // si algo se pierde en el camino, lo seguro es asumir el caso frecuente y
    // dejar que la validación pida la fecha.
    expect(leerCierre({}).accion).toBe('presentada')
    expect(leerCierre({ accion: 'cualquier-cosa' }).accion).toBe('presentada')
    expect(leerCierre({ accion: 'cancelada' }).accion).toBe('cancelada')
  })

  it('descarta una fecha que no es fecha', () => {
    expect(leerCierre({ fechaPresentacion: '13/03/2026' }).fechaPresentacion).toBeNull()
    expect(leerCierre({ fechaPresentacion: '' }).fechaPresentacion).toBeNull()
    expect(leerCierre({ fechaPresentacion: '2026-03-13' }).fechaPresentacion).toBe(
      '2026-03-13',
    )
  })

  it('convierte los textos en blanco a null', () => {
    const leido = leerCierre({ descripcion: '   ', motivo: '\n' })
    expect(leido.descripcion).toBeNull()
    expect(leido.motivo).toBeNull()
  })

  it('recorta los textos', () => {
    expect(leerCierre({ motivo: '  se desistió el actor  ' }).motivo).toBe(
      'se desistió el actor',
    )
  })

  it('lee el reconocimiento de extemporaneidad solo con "on"', () => {
    expect(leerCierre({ reconoceExtemporanea: 'on' }).reconoceExtemporanea).toBe(true)
    expect(leerCierre({ reconoceExtemporanea: 'true' }).reconoceExtemporanea).toBe(
      false,
    )
    expect(leerCierre({}).reconoceExtemporanea).toBe(false)
  })
})

describe('esExtemporanea', () => {
  it('el mismo día del vencimiento está en tiempo', () => {
    // Se presenta el último día del plazo: es lo más común de todo.
    expect(esExtemporanea('2026-03-16', '2026-03-16')).toBe(false)
  })

  it('un día después ya es fuera de plazo', () => {
    expect(esExtemporanea('2026-03-17', '2026-03-16')).toBe(true)
  })

  it('antes del vencimiento está en tiempo', () => {
    expect(esExtemporanea('2026-03-02', '2026-03-16')).toBe(false)
  })

  it('compara bien cruzando mes y año', () => {
    expect(esExtemporanea('2027-01-02', '2026-12-31')).toBe(true)
    expect(esExtemporanea('2026-12-31', '2027-01-02')).toBe(false)
  })
})

describe('validarCierre — presentada', () => {
  it('acepta una presentación en tiempo', () => {
    expect(validarCierre(captura(), CONTEXTO)).toEqual([])
  })

  it('exige la fecha', () => {
    const problemas = validarCierre(captura({ fechaPresentacion: null }), CONTEXTO)
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.campo).toBe('fechaPresentacion')
  })

  it('rechaza una fecha futura', () => {
    // Marcar como presentado algo que todavía no se presenta saca el plazo de
    // la vigilancia justo mientras sigue corriendo.
    const problemas = validarCierre(
      captura({ fechaPresentacion: '2026-03-21' }),
      CONTEXTO,
    )
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.campo).toBe('fechaPresentacion')
    expect(problemas[0]?.mensaje).toMatch(/futura/i)
  })

  it('acepta la presentación de hoy', () => {
    expect(
      validarCierre(captura({ fechaPresentacion: CONTEXTO.hoy }), {
        ...CONTEXTO,
        // Con vencimiento posterior para aislar este caso de la extemporaneidad.
        fechaVencimiento: '2026-03-25',
      }),
    ).toEqual([])
  })

  it('rechaza una fecha anterior a la notificación', () => {
    // El error de captura más común es el año: un 2025 volvería "anticipada"
    // una presentación que en realidad fue tardía.
    const problemas = validarCierre(
      captura({ fechaPresentacion: '2025-03-13' }),
      CONTEXTO,
    )
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.campo).toBe('fechaPresentacion')
    expect(problemas[0]?.mensaje).toMatch(/antes de la notificación/i)
  })

  it('el mismo día de la notificación sí se puede presentar', () => {
    expect(
      validarCierre(
        captura({ fechaPresentacion: CONTEXTO.fechaNotificacion }),
        CONTEXTO,
      ),
    ).toEqual([])
  })

  it('la extemporánea no pasa sin reconocimiento expreso', () => {
    const problemas = validarCierre(
      captura({ fechaPresentacion: '2026-03-18' }),
      CONTEXTO,
    )
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.campo).toBe('reconoceExtemporanea')
  })

  it('la extemporánea pasa cuando alguien la reconoce', () => {
    expect(
      validarCierre(
        captura({ fechaPresentacion: '2026-03-18', reconoceExtemporanea: true }),
        CONTEXTO,
      ),
    ).toEqual([])
  })

  it('mide la extemporaneidad contra la fecha ajustada a mano', () => {
    // El contexto trae la fecha EFECTIVA. Si el abogado corrió el vencimiento
    // al 20 por una suspensión, presentar el 18 está en tiempo.
    expect(
      validarCierre(captura({ fechaPresentacion: '2026-03-18' }), {
        ...CONTEXTO,
        fechaVencimiento: '2026-03-20',
      }),
    ).toEqual([])
  })

  it('no pide motivo al presentar', () => {
    const problemas = validarCierre(captura({ motivo: null }), CONTEXTO)
    expect(problemas).toEqual([])
  })
})

describe('validarCierre — cancelada', () => {
  const cancelar = (motivo: string | null) =>
    captura({ accion: 'cancelada', fechaPresentacion: null, motivo })

  it('exige motivo', () => {
    const problemas = validarCierre(cancelar(null), CONTEXTO)
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.campo).toBe('motivo')
  })

  it('rechaza un motivo de relleno', () => {
    // "ya" o "n/a" no es un motivo: es la forma de saltarse el campo.
    expect(validarCierre(cancelar('n/a'), CONTEXTO)).toHaveLength(1)
    expect(validarCierre(cancelar('ya'), CONTEXTO)).toHaveLength(1)
  })

  it('acepta un motivo real', () => {
    expect(
      validarCierre(cancelar('El actor se desistió y el juez lo tuvo por desistido.'), CONTEXTO),
    ).toEqual([])
  })

  it('no pide fecha de presentación', () => {
    expect(
      validarCierre(cancelar('Se acumuló al expediente 431/2026.'), CONTEXTO),
    ).toEqual([])
  })
})

describe('tituloActuacion', () => {
  const etiqueta = 'Contestación de demanda — ordinario mercantil'

  it('nombra la extemporaneidad, no la esconde', () => {
    const titulo = tituloActuacion(captura(), etiqueta, true)
    expect(titulo).toContain('EXTEMPORÁNEA')
    expect(titulo).toContain(etiqueta)
  })

  it('la presentación en tiempo se llama por su nombre', () => {
    const titulo = tituloActuacion(captura(), etiqueta, false)
    expect(titulo).toBe(`Promoción presentada — ${etiqueta}`)
    expect(titulo).not.toContain('EXTEMPORÁNEA')
  })

  it('la cancelación se distingue de la presentación', () => {
    const titulo = tituloActuacion(
      captura({ accion: 'cancelada' }),
      etiqueta,
      false,
    )
    expect(titulo).toBe(`Plazo cancelado — ${etiqueta}`)
  })
})

describe('detalleActuacion', () => {
  it('escribe las dos fechas cuando fue extemporánea', () => {
    // Dentro de dos años, "presentada el 18" a secas no le dice nada a nadie.
    const detalle = detalleActuacion(
      captura({ fechaPresentacion: '2026-03-18' }),
      '2026-03-16',
      true,
    )
    expect(detalle).toContain('18 de marzo de 2026')
    expect(detalle).toContain('16 de marzo de 2026')
    expect(detalle).toContain('fuera de plazo')
  })

  it('conserva lo que capturó el abogado', () => {
    const detalle = detalleActuacion(
      captura({
        fechaPresentacion: '2026-03-18',
        descripcion: 'Se acompañó el acuse con sello del juzgado.',
      }),
      '2026-03-16',
      true,
    )
    expect(detalle).toContain('Se acompañó el acuse con sello del juzgado.')
  })

  it('la presentación en tiempo no habla de plazos perdidos', () => {
    const detalle = detalleActuacion(captura(), '2026-03-16', false)
    expect(detalle).toBe('Contestación de demanda con acuse sellado.')
    expect(detalle).not.toMatch(/fuera de plazo/i)
  })

  it('nunca queda en blanco', () => {
    const detalle = detalleActuacion(
      captura({ descripcion: null }),
      '2026-03-16',
      false,
    )
    expect(detalle.length).toBeGreaterThan(0)
  })

  it('la cancelación deja escrito el motivo', () => {
    const detalle = detalleActuacion(
      captura({ accion: 'cancelada', motivo: 'Quedó sin materia por el convenio.' }),
      '2026-03-16',
      false,
    )
    expect(detalle).toContain('Quedó sin materia por el convenio.')
  })
})

describe('avisoExtemporaneidad', () => {
  it('dice las dos fechas y que la bitácora no se edita', () => {
    const aviso = avisoExtemporaneidad('2026-03-18', '2026-03-16')
    expect(aviso).toContain('18 de marzo de 2026')
    expect(aviso).toContain('16 de marzo de 2026')
    expect(aviso).toMatch(/fuera de plazo/i)
    expect(aviso).toMatch(/no se puede editar/i)
  })
})

describe('tipoActuacionDeCierre y estadoResultante', () => {
  it('presentar deja una promoción y el plazo atendido', () => {
    expect(tipoActuacionDeCierre(captura())).toBe('promocion')
    expect(estadoResultante(captura())).toBe('atendido')
  })

  it('cancelar no inventa un escrito que nunca se presentó', () => {
    const c = captura({ accion: 'cancelada' })
    expect(tipoActuacionDeCierre(c)).toBe('nota_interna')
    expect(estadoResultante(c)).toBe('cancelado')
  })

  it('la extemporánea también queda atendida: el aviso lo da la bitácora', () => {
    // Dejarla "vencida" la mantendría en rojo en el panel para siempre, y el
    // panel es para lo que hay que hacer hoy. El hecho vive en la bitácora.
    expect(
      estadoResultante(
        captura({ fechaPresentacion: '2026-03-18', reconoceExtemporanea: true }),
      ),
    ).toBe('atendido')
  })
})

describe('lo que manda el formulario', () => {
  it('se lee completo, sin campos perdidos', () => {
    const leido = leerCierre({
      accion: 'presentada',
      fechaPresentacion: '2026-03-18',
      descripcion: 'Escrito de contestación.',
      reconoceExtemporanea: 'on',
    })
    expect(leido).toEqual({
      accion: 'presentada',
      fechaPresentacion: '2026-03-18',
      descripcion: 'Escrito de contestación.',
      motivo: null,
      reconoceExtemporanea: true,
    })
  })
})

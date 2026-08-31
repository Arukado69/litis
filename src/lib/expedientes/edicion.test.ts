import { describe, expect, it } from 'vitest'

import {
  anotacionDeCambios,
  cambiosDeEdicion,
  edicionDesde,
  leerEdicion,
  normalizarEdicion,
  validarEdicion,
  type CapturaEdicion,
  type ContextoEdicion,
} from './edicion'

const ETAPAS = [
  { clave: 'emplazamiento', nombre: 'Emplazamiento', paralela: false },
  { clave: 'pruebas', nombre: 'Ofrecimiento de pruebas', paralela: false },
  { clave: 'suspension', nombre: 'Suspensión', paralela: true },
] as const

const CONTEXTO: ContextoEdicion = {
  hoy: '2026-09-03',
  etapas: ETAPAS,
  plazosPendientes: 0,
}

function edicion(over: Partial<CapturaEdicion> = {}): CapturaEdicion {
  return {
    numeroOrgano: '431/2026',
    instancia: 'Primera instancia',
    entidad: 'Ciudad de México',
    cuantia: 250000,
    responsableId: 'perfil-1',
    restringido: false,
    notas: null,
    estado: 'activo',
    resultado: null,
    fechaConclusion: null,
    etapaActual: 'emplazamiento',
    ...over,
  }
}

describe('leerEdicion', () => {
  it('lee lo que manda el formulario', () => {
    const leido = leerEdicion({
      numeroOrgano: '  431/2026 ',
      instancia: 'Primera instancia',
      cuantia: '$250,000.00',
      responsableId: 'perfil-1',
      estado: 'activo',
      etapaActual: 'pruebas',
    })
    expect(leido.numeroOrgano).toBe('431/2026')
    expect(leido.cuantia).toBe(250000)
    expect(leido.estado).toBe('activo')
    expect(leido.etapaActual).toBe('pruebas')
  })

  it('un estado inventado cae en "activo" en vez de romper', () => {
    expect(leerEdicion({ estado: 'ganado' }).estado).toBe('activo')
    expect(leerEdicion({}).estado).toBe('activo')
  })

  it('descarta un resultado que no existe', () => {
    expect(leerEdicion({ resultado: 'excelente' }).resultado).toBeNull()
  })

  it('los campos en blanco quedan en null, no en cadena vacía', () => {
    // `null` contra `''` es la diferencia entre "sin cambio" y "cambió", y es
    // como se cuelan los cambios fantasma a la bitácora.
    const leido = leerEdicion({ numeroOrgano: '   ', notas: '' })
    expect(leido.numeroOrgano).toBeNull()
    expect(leido.notas).toBeNull()
  })
})

describe('validarEdicion — etapas', () => {
  it('acepta una etapa del expediente', () => {
    expect(validarEdicion(edicion({ etapaActual: 'pruebas' }), CONTEXTO)).toEqual([])
  })

  it('rechaza una etapa ajena', () => {
    const problemas = validarEdicion(edicion({ etapaActual: 'alegatos' }), CONTEXTO)
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.campo).toBe('etapaActual')
  })

  it('una etapa paralela no puede ser la etapa actual', () => {
    // El asunto no "está en" la suspensión: la tiene, mientras sigue en la
    // etapa que traía.
    const problemas = validarEdicion(edicion({ etapaActual: 'suspension' }), CONTEXTO)
    expect(problemas).toHaveLength(1)
    expect(problemas[0]?.mensaje).toMatch(/paralelo/i)
  })

  it('deja quitar la etapa', () => {
    expect(validarEdicion(edicion({ etapaActual: null }), CONTEXTO)).toEqual([])
  })
})

describe('validarEdicion — conclusión', () => {
  it('concluir exige resultado', () => {
    const problemas = validarEdicion(
      edicion({ estado: 'concluido', resultado: null }),
      CONTEXTO,
    )
    expect(problemas.map((p) => p.campo)).toContain('resultado')
  })

  it('concluir con resultado pasa', () => {
    expect(
      validarEdicion(
        edicion({ estado: 'concluido', resultado: 'favorable' }),
        CONTEXTO,
      ),
    ).toEqual([])
  })

  it('un asunto activo no lleva resultado', () => {
    const problemas = validarEdicion(
      edicion({ estado: 'activo', resultado: 'favorable' }),
      CONTEXTO,
    )
    expect(problemas.map((p) => p.campo)).toContain('resultado')
  })

  it('archivar sí admite resultado', () => {
    expect(
      validarEdicion(
        edicion({ estado: 'archivado', resultado: 'caducidad' }),
        CONTEXTO,
      ),
    ).toEqual([])
  })

  it('rechaza una conclusión con fecha futura', () => {
    const problemas = validarEdicion(
      edicion({
        estado: 'concluido',
        resultado: 'convenio',
        fechaConclusion: '2026-12-01',
      }),
      CONTEXTO,
    )
    expect(problemas.map((p) => p.campo)).toContain('fechaConclusion')
  })
})

describe('validarEdicion — no se cierra con plazos corriendo', () => {
  const conPlazos: ContextoEdicion = { ...CONTEXTO, plazosPendientes: 2 }

  it('bloquea concluir', () => {
    // Si no, los términos de un asunto cerrado siguen pidiendo atención en el
    // panel para siempre.
    const problemas = validarEdicion(
      edicion({ estado: 'concluido', resultado: 'convenio' }),
      conPlazos,
    )
    expect(problemas.map((p) => p.campo)).toContain('estado')
    expect(problemas.find((p) => p.campo === 'estado')?.mensaje).toContain('2 plazos')
  })

  it('bloquea archivar', () => {
    expect(
      validarEdicion(edicion({ estado: 'archivado' }), conPlazos).map((p) => p.campo),
    ).toContain('estado')
  })

  it('deja suspender: el asunto sigue vivo y sus plazos también', () => {
    expect(validarEdicion(edicion({ estado: 'suspendido' }), conPlazos)).toEqual([])
  })

  it('el singular se escribe en singular', () => {
    const problemas = validarEdicion(edicion({ estado: 'archivado' }), {
      ...CONTEXTO,
      plazosPendientes: 1,
    })
    expect(problemas[0]?.mensaje).toContain('1 plazo corriendo')
  })
})

describe('normalizarEdicion', () => {
  it('concluir sin fecha se fecha hoy', () => {
    const listo = normalizarEdicion(
      edicion({ estado: 'concluido', resultado: 'favorable' }),
      '2026-09-03',
    )
    expect(listo.fechaConclusion).toBe('2026-09-03')
  })

  it('respeta la fecha que se capturó', () => {
    const listo = normalizarEdicion(
      edicion({
        estado: 'concluido',
        resultado: 'favorable',
        fechaConclusion: '2026-08-20',
      }),
      '2026-09-03',
    )
    expect(listo.fechaConclusion).toBe('2026-08-20')
  })

  it('reabrir borra el resultado y la conclusión', () => {
    // Un expediente activo con "desfavorable" pegado es un dato que contradice
    // al otro, y el que se quede va a ser el equivocado.
    const listo = normalizarEdicion(
      edicion({
        estado: 'activo',
        resultado: 'desfavorable',
        fechaConclusion: '2026-08-20',
      }),
      '2026-09-03',
    )
    expect(listo.resultado).toBeNull()
    expect(listo.fechaConclusion).toBeNull()
  })
})

describe('cambiosDeEdicion', () => {
  const DIC = {
    personas: { 'perfil-1': 'Nadia Ruiz', 'perfil-2': 'Danny Salas' },
    etapas: { emplazamiento: 'Emplazamiento', pruebas: 'Ofrecimiento de pruebas' },
  }

  it('sin cambios, lista vacía', () => {
    expect(cambiosDeEdicion(edicion(), edicion(), DIC)).toEqual([])
  })

  it('traduce los ids a nombres', () => {
    // "de 8f3a… a 21bc…" en la bitácora no le dice nada a nadie.
    const [cambio] = cambiosDeEdicion(
      edicion(),
      edicion({ responsableId: 'perfil-2' }),
      DIC,
    )
    expect(cambio?.antes).toBe('Nadia Ruiz')
    expect(cambio?.despues).toBe('Danny Salas')
  })

  it('marca cuáles son mayores', () => {
    const cambios = cambiosDeEdicion(
      edicion(),
      edicion({ etapaActual: 'pruebas', notas: 'Cliente pidió copia.' }),
      DIC,
    )
    expect(cambios.find((c) => c.campo === 'etapaActual')?.mayor).toBe(true)
    expect(cambios.find((c) => c.campo === 'notas')?.mayor).toBe(false)
  })

  it('un campo que se llena dice "(vacío)" como antes', () => {
    const [cambio] = cambiosDeEdicion(
      edicion({ numeroOrgano: null }),
      edicion({ numeroOrgano: '431/2026' }),
      DIC,
    )
    expect(cambio?.antes).toBe('(vacío)')
    expect(cambio?.despues).toBe('431/2026')
  })

  it('escribe los estados y resultados con su etiqueta', () => {
    const cambios = cambiosDeEdicion(
      edicion(),
      edicion({ estado: 'concluido', resultado: 'parcialmente_favorable' }),
      DIC,
    )
    expect(cambios.find((c) => c.campo === 'estado')?.despues).toBe('Concluido')
    expect(cambios.find((c) => c.campo === 'resultado')?.despues).toBe(
      'Parcialmente favorable',
    )
  })

  it('la cuantía sale en pesos', () => {
    const [cambio] = cambiosDeEdicion(
      edicion({ cuantia: null }),
      edicion({ cuantia: 250000 }),
      DIC,
    )
    expect(cambio?.despues).toContain('250,000')
  })

  it('el booleano se lee como sí o no', () => {
    const [cambio] = cambiosDeEdicion(
      edicion(),
      edicion({ restringido: true }),
      DIC,
    )
    expect(cambio?.antes).toBe('no')
    expect(cambio?.despues).toBe('sí')
  })
})

describe('anotacionDeCambios', () => {
  const DIC = { personas: {}, etapas: {} }

  it('nada que anotar si solo cambió lo menor', () => {
    // Una bitácora que registra cada tecleo es una bitácora que nadie lee.
    const cambios = cambiosDeEdicion(
      edicion(),
      edicion({ notas: 'Llamó el cliente.', instancia: 'Toca 12/2026' }),
      DIC,
    )
    expect(cambios.length).toBeGreaterThan(0)
    expect(anotacionDeCambios(cambios)).toBeNull()
  })

  it('un solo cambio mayor se titula con él', () => {
    const cambios = cambiosDeEdicion(
      edicion({ numeroOrgano: null }),
      edicion({ numeroOrgano: '431/2026' }),
      DIC,
    )
    const anotacion = anotacionDeCambios(cambios)
    expect(anotacion?.titulo).toBe('Número del órgano: (vacío) → 431/2026')
  })

  it('varios cambios mayores se resumen en una sola anotación', () => {
    // Una por edición, no una por campo: dentro de dos años nadie quiere leer
    // once renglones del mismo minuto.
    const cambios = cambiosDeEdicion(
      edicion(),
      edicion({ etapaActual: 'pruebas', responsableId: 'perfil-2', restringido: true }),
      DIC,
    )
    const anotacion = anotacionDeCambios(cambios)
    expect(anotacion?.titulo).toContain('3 cambios')
    expect(anotacion?.detalle.split('\n')).toHaveLength(3)
  })

  it('deja la CLAVE de la etapa, no su nombre', () => {
    // `actuaciones.etapa_clave` liga con `expediente_etapas.clave`. Guardar
    // ahí el nombre bonito deja un rastro que no liga con nada.
    const cambios = cambiosDeEdicion(
      edicion(),
      edicion({ etapaActual: 'pruebas' }),
      { personas: {}, etapas: { pruebas: 'Ofrecimiento de pruebas' } },
    )
    const anotacion = anotacionDeCambios(cambios)
    expect(anotacion?.etapaClave).toBe('pruebas')
    expect(anotacion?.detalle).toContain('Ofrecimiento de pruebas')
  })

  it('sin movimiento de etapa, no hay etapa que anotar', () => {
    const cambios = cambiosDeEdicion(edicion(), edicion({ restringido: true }), DIC)
    expect(anotacionDeCambios(cambios)?.etapaClave).toBeNull()
  })
})

describe('edicionDesde', () => {
  it('el antes y el después salen de la misma forma', () => {
    const fila = edicion()
    expect(cambiosDeEdicion(edicionDesde(fila), leerEdicion({
      numeroOrgano: '431/2026',
      instancia: 'Primera instancia',
      entidad: 'Ciudad de México',
      cuantia: '250000',
      responsableId: 'perfil-1',
      estado: 'activo',
      etapaActual: 'emplazamiento',
    }))).toEqual([])
  })
})

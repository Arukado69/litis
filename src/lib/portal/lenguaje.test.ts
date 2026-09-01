import { describe, expect, it } from 'vitest'

import { etapasDeVia } from '@/lib/expedientes/etapas'
import { VIAS } from '@/lib/expedientes/materias'
import { FASES } from '@/lib/tablero/fases'

import {
  AVISO_PORTAL,
  FASE_EN_LLANO,
  SIN_ETAPA,
  faseEnLlano,
  ultimoMovimiento,
} from './lenguaje'

const HOY = '2026-09-03'

describe('faseEnLlano', () => {
  it('traduce la etapa técnica a algo que se entienda', () => {
    const llano = faseEnLlano('merc.ordinario', 'citacion_sentencia')
    expect(llano.titulo).toBe('Por resolverse')
    expect(llano.queSignifica).not.toContain('citación')
  })

  it('sin etapa capturada, lo dice en vez de inventar una', () => {
    expect(faseEnLlano('merc.ordinario', null)).toBe(SIN_ETAPA)
  })

  it('una etapa desconocida cae en el genérico, no revienta', () => {
    expect(faseEnLlano('merc.ordinario', 'etapa_rara')).toBe(SIN_ETAPA)
  })

  it('respeta la excepción por vía del tablero', () => {
    // "revisión" en corporativo es revisar el documento, no un recurso: al
    // cliente no se le puede decir que su asunto está en un tribunal superior.
    expect(faseEnLlano('corp.asunto', 'revision').titulo).toBe('Por resolverse')
    expect(faseEnLlano('amp.indirecto', 'revision').titulo).toBe(
      'En revisión de un tribunal superior',
    )
  })
})

describe('TODA etapa del catálogo tiene traducción', () => {
  it('ninguna vía deja al cliente sin texto', () => {
    // Si mañana se agrega una etapa y no se mapea, el cliente vería "En
    // seguimiento" para un asunto que sí tiene etapa — un dato peor que
    // ninguno, porque parece que nadie lo ha tocado.
    const mudas: string[] = []
    for (const via of VIAS) {
      for (const etapa of etapasDeVia(via.id)) {
        if (etapa.paralela) continue
        if (faseEnLlano(via.id, etapa.id) === SIN_ETAPA) {
          mudas.push(`${via.id}:${etapa.id}`)
        }
      }
    }
    expect(mudas).toEqual([])
  })

  it('las seis fases tienen su traducción completa', () => {
    for (const f of FASES) {
      const llano = FASE_EN_LLANO[f.id]
      expect(llano.titulo.length).toBeGreaterThan(0)
      expect(llano.queSignifica.length).toBeGreaterThan(0)
      expect(llano.queSigue.length).toBeGreaterThan(0)
    }
  })
})

describe('⚠️ el portal no promete nada', () => {
  const todos = [...Object.values(FASE_EN_LLANO), SIN_ETAPA]
  const texto = todos
    .map((f) => `${f.titulo} ${f.queSignifica} ${f.queSigue}`)
    .join(' ')
    .toLowerCase()

  it('no insinúa cuándo termina', () => {
    // Un litigante no puede saberlo: depende del juzgado, de la contraparte y
    // de si hay amparo. Un portal que lo insinúe convierte una expectativa del
    // sistema en una promesa del abogado.
    for (const prohibido of [
      'en unos días',
      'en unas semanas',
      'próximamente',
      'pronto',
      'ya falta poco',
      'aproximadamente',
      'estimamos',
    ]) {
      expect(texto).not.toContain(prohibido)
    }
  })

  it('no pronostica el resultado', () => {
    for (const prohibido of ['vamos a ganar', 'favorable para ti', 'seguramente']) {
      expect(texto).not.toContain(prohibido)
    }
  })

  it('dice en voz alta que los tiempos no dependen del despacho', () => {
    expect(texto).toContain('no dependen del despacho')
  })
})

describe('ultimoMovimiento', () => {
  it('hoy y ayer se dicen por su nombre', () => {
    expect(ultimoMovimiento(`${HOY}T10:00:00Z`, HOY)).toBe('Último movimiento: hoy.')
    expect(ultimoMovimiento('2026-09-02T10:00:00Z', HOY)).toBe(
      'Último movimiento: ayer.',
    )
  })

  it('en días hasta la semana', () => {
    expect(ultimoMovimiento('2026-08-31T00:00:00Z', HOY)).toContain('hace 3 días')
  })

  it('en semanas hasta el mes', () => {
    expect(ultimoMovimiento('2026-08-20T00:00:00Z', HOY)).toContain('semanas')
  })

  it('en meses de ahí en adelante', () => {
    expect(ultimoMovimiento('2026-06-03T00:00:00Z', HOY)).toContain('3 meses')
  })

  it('el singular se escribe en singular', () => {
    expect(ultimoMovimiento('2026-08-04T00:00:00Z', HOY)).toContain('1 mes')
    expect(ultimoMovimiento('2026-08-27T00:00:00Z', HOY)).toContain('1 semana')
  })

  it('sin movimientos, lo dice', () => {
    expect(ultimoMovimiento(null, HOY)).toMatch(/sin movimientos/i)
  })

  it('NO se disculpa ni se justifica', () => {
    // Los tiempos muertos de un juicio son normales y no son culpa del
    // despacho; una disculpa al lado del dato suena peor que el dato solo.
    const viejo = ultimoMovimiento('2026-01-01T00:00:00Z', HOY).toLowerCase()
    for (const prohibido of ['disculpa', 'lamentamos', 'perdón', 'sabemos que']) {
      expect(viejo).not.toContain(prohibido)
    }
  })
})

describe('el aviso del portal', () => {
  it('explica POR QUÉ no está todo, en vez de dejar que se suponga', () => {
    expect(AVISO_PORTAL).toMatch(/términos procesales/i)
    expect(AVISO_PORTAL).toMatch(/notas internas/i)
    expect(AVISO_PORTAL).toMatch(/no se pueden interpretar/i)
  })

  it('deja una salida clara', () => {
    expect(AVISO_PORTAL).toMatch(/escríbele a tu abogado/i)
  })
})

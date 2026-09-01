import { describe, expect, it } from 'vitest'

import type { AlertaPendiente, PlazoVigilado } from '@/lib/plazos/alertas'

import { nivelMasUrgente, repartir, type Destinatario } from './destinatarios'
import { asunto, cuerpo, renglon } from './redaccion'

const TITULAR: Destinatario = {
  perfilId: 'titular-1',
  nombre: 'Nadia Ruiz',
  correo: 'nadia@despacho.mx',
}

function plazo(over: Partial<PlazoVigilado> = {}): PlazoVigilado {
  return {
    plazoId: 'p1',
    expedienteId: 'e1',
    calendarioId: null,
    numeroExpediente: '431/2026',
    caratula: 'Pérez vs. Constructora XYZ',
    etiqueta: 'Contestación de demanda',
    fechaVencimiento: '2026-03-16',
    responsableId: 'danny',
    responsableNombre: 'Danny Salas',
    responsableEmail: 'danny@despacho.mx',
    atendido: false,
    ...over,
  }
}

function alerta(
  nivel: AlertaPendiente['nivel'],
  diasRestantes: number,
  over: Partial<PlazoVigilado> = {},
): AlertaPendiente {
  return { nivel, diasRestantes, plazo: plazo(over) }
}

describe('nivelMasUrgente', () => {
  it('gana el vencido sobre todo lo demás', () => {
    expect(
      nivelMasUrgente([alerta('t_menos_5', 5), alerta('vencido', -2)]),
    ).toBe('vencido')
  })

  it('sin alertas, no hay nivel', () => {
    expect(nivelMasUrgente([])).toBeNull()
  })

  it('respeta el orden entre los intermedios', () => {
    expect(
      nivelMasUrgente([alerta('t_menos_5', 5), alerta('t_menos_1', 1)]),
    ).toBe('t_menos_1')
  })
})

describe('repartir', () => {
  it('junta en UN lote todo lo de la misma persona', () => {
    // Cinco correos idénticos en el mismo minuto se archivan sin abrir, y el
    // día que llegue el que importaba también se va a archivar sin abrir.
    const { lotes } = repartir({
      alertas: [
        alerta('t_menos_1', 1, { plazoId: 'a' }),
        alerta('t_menos_3', 3, { plazoId: 'b' }),
        alerta('vence_hoy', 0, { plazoId: 'c' }),
      ],
      titular: TITULAR,
    })
    expect(lotes).toHaveLength(1)
    expect(lotes[0]?.alertas).toHaveLength(3)
  })

  it('separa a personas distintas', () => {
    const { lotes } = repartir({
      alertas: [
        alerta('t_menos_1', 1, { responsableId: 'danny', responsableEmail: 'd@x.mx' }),
        alerta('t_menos_1', 1, { responsableId: 'ana', responsableEmail: 'a@x.mx' }),
      ],
      titular: TITULAR,
    })
    expect(lotes).toHaveLength(2)
  })

  it('ordena cada lote de más urgente a menos', () => {
    const { lotes } = repartir({
      alertas: [
        alerta('t_menos_5', 5, { plazoId: 'tranquilo' }),
        alerta('vencido', -3, { plazoId: 'perdido' }),
        alerta('vence_hoy', 0, { plazoId: 'hoy' }),
      ],
      titular: TITULAR,
    })
    expect(lotes[0]?.alertas.map((a) => a.plazo.plazoId)).toEqual([
      'perdido',
      'hoy',
      'tranquilo',
    ])
  })

  it('lo que no tiene responsable le llega al titular, marcado', () => {
    // Un plazo sin responsable es el más peligroso: nadie lo está viendo, así
    // que nadie lo va a reclamar.
    const { lotes } = repartir({
      alertas: [
        alerta('vence_hoy', 0, {
          responsableId: null,
          responsableNombre: null,
          responsableEmail: null,
        }),
      ],
      titular: TITULAR,
    })
    expect(lotes).toHaveLength(1)
    expect(lotes[0]?.destinatario.correo).toBe('nadia@despacho.mx')
    expect(lotes[0]?.huerfanas).toBe(true)
  })

  it('un responsable sin correo cuenta como huérfano', () => {
    // Sin correo no hay a dónde avisarle; tratarlo como atendido lo dejaría en
    // silencio.
    const { lotes } = repartir({
      alertas: [alerta('vence_hoy', 0, { responsableEmail: null })],
      titular: TITULAR,
    })
    expect(lotes[0]?.huerfanas).toBe(true)
  })

  it('sin titular, lo huérfano se reporta en vez de perderse', () => {
    // La corrida tiene que poder decir que hubo términos de los que no le pudo
    // avisar a nadie. Tragárselos sería el peor silencio posible.
    const { lotes, sinDestinatario } = repartir({
      alertas: [alerta('vencido', -1, { responsableId: null, responsableEmail: null })],
      titular: null,
    })
    expect(lotes).toHaveLength(0)
    expect(sinDestinatario).toHaveLength(1)
  })

  it('lo huérfano va en su propio lote, no mezclado con lo del titular', () => {
    // Son dos mensajes distintos: "esto es tuyo" y "esto no es de nadie".
    const { lotes } = repartir({
      alertas: [
        alerta('t_menos_3', 3, {
          responsableId: 'titular-1',
          responsableEmail: 'nadia@despacho.mx',
        }),
        alerta('vence_hoy', 0, { responsableId: null, responsableEmail: null }),
      ],
      titular: TITULAR,
    })
    expect(lotes).toHaveLength(2)
    expect(lotes.filter((l) => l.huerfanas)).toHaveLength(1)
  })
})

describe('asunto', () => {
  const lote = (alertas: AlertaPendiente[], huerfanas = false) => ({
    destinatario: TITULAR,
    alertas,
    huerfanas,
  })

  it('con un solo término, lo nombra: se resuelve sin abrir el correo', () => {
    expect(asunto(lote([alerta('vence_hoy', 0)]))).toContain('Contestación de demanda')
    expect(asunto(lote([alerta('vence_hoy', 0)]))).toContain('431/2026')
  })

  it('dice lo PEOR que hay dentro, no un resumen neutro', () => {
    const texto = asunto(lote([alerta('vencido', -2), alerta('t_menos_5', 5)]))
    expect(texto).toMatch(/vencido/i)
    expect(texto).not.toMatch(/resumen/i)
  })

  it('con varios, cuenta cuántos más hay', () => {
    const texto = asunto(
      lote([alerta('vence_hoy', 0), alerta('t_menos_3', 3), alerta('t_menos_5', 5)]),
    )
    expect(texto).toContain('2 plazos más')
  })

  it('el singular se escribe en singular', () => {
    const texto = asunto(lote([alerta('vence_hoy', 0), alerta('t_menos_3', 3)]))
    expect(texto).toContain('1 plazo más')
  })
})

describe('renglon', () => {
  it('se entiende sin abrir el sistema', () => {
    const texto = renglon(alerta('t_menos_1', 1))
    expect(texto).toContain('Contestación de demanda')
    expect(texto).toContain('431/2026')
    expect(texto).toContain('Pérez vs. Constructora XYZ')
    expect(texto).toContain('marzo')
  })
})

describe('cuerpo', () => {
  it('lleva el aviso de que no dictamina', () => {
    // Un correo que da la fecha por definitiva le pasa al abogado un riesgo
    // que no aceptó.
    const armado = cuerpo(
      { destinatario: TITULAR, alertas: [alerta('vence_hoy', 0)], huerfanas: false },
      'https://litis.mx',
    )
    expect(armado.pie).toMatch(/no es una asesoría|no dictamina|control interno/i)
  })

  it('el enlace del panel sale del origen que se le pasa', () => {
    const armado = cuerpo(
      { destinatario: TITULAR, alertas: [alerta('vence_hoy', 0)], huerfanas: false },
      'https://litis.mx/',
    )
    expect(armado.boton.url).toBe('https://litis.mx/panel')
  })

  it('al titular le explica por qué le llega lo que no es suyo', () => {
    const armado = cuerpo(
      { destinatario: TITULAR, alertas: [alerta('vence_hoy', 0)], huerfanas: true },
      'https://litis.mx',
    )
    expect(armado.parrafos[0]).toMatch(/no tienen responsable/i)
    expect(armado.parrafos[0]).toMatch(/titular/i)
  })

  it('un vencido no se disfraza de recordatorio amable', () => {
    const armado = cuerpo(
      { destinatario: TITULAR, alertas: [alerta('vencido', -2)], huerfanas: false },
      'https://litis.mx',
    )
    expect(armado.parrafos.join(' ')).toMatch(/responsabilidad/i)
  })

  it('trae un renglón por término, más la entrada', () => {
    const armado = cuerpo(
      {
        destinatario: TITULAR,
        alertas: [alerta('t_menos_3', 3, { plazoId: 'a' }), alerta('t_menos_5', 5, { plazoId: 'b' })],
        huerfanas: false,
      },
      'https://litis.mx',
    )
    expect(armado.parrafos.length).toBeGreaterThanOrEqual(3)
  })
})

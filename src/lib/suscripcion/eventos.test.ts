import { describe, expect, it } from 'vitest'

import { interpretarEvento } from './eventos'

const FIN = 1790000000 // segundos unix

function suscripcion(over: Record<string, unknown> = {}) {
  return {
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_1',
        customer: 'cus_1',
        status: 'active',
        cancel_at_period_end: false,
        metadata: { despacho_id: 'd-1' },
        items: { data: [{ quantity: 4, current_period_end: FIN }] },
        ...over,
      },
    },
  }
}

describe('interpretar el evento de Stripe', () => {
  it('enlaza el despacho al terminar el pago', () => {
    const i = interpretarEvento({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          client_reference_id: 'd-1',
          customer: 'cus_1',
          subscription: 'sub_1',
        },
      },
    })
    expect(i).toEqual({
      tipo: 'enlazar',
      despachoId: 'd-1',
      clienteId: 'cus_1',
      suscripcionId: 'sub_1',
    })
  })

  it('lee el cliente venga como id suelto o expandido', () => {
    const i = interpretarEvento(suscripcion({ customer: { id: 'cus_9' } }))
    expect(i.tipo).toBe('aplicar')
    if (i.tipo === 'aplicar') expect(i.clienteId).toBe('cus_9')
  })

  /**
   * La trampa que más cuesta: `current_period_end` se movió al renglón de la
   * suscripción en las versiones recientes de la API.
   */
  it('encuentra el fin de periodo en los dos lugares donde Stripe lo pone', () => {
    const enElRenglon = interpretarEvento(suscripcion())
    const enLaSuscripcion = interpretarEvento(
      suscripcion({
        current_period_end: FIN,
        items: { data: [{ quantity: 4 }] },
      }),
    )
    const esperado = new Date(FIN * 1000).toISOString()
    if (enElRenglon.tipo === 'aplicar') expect(enElRenglon.periodoFin).toBe(esperado)
    if (enLaSuscripcion.tipo === 'aplicar') {
      expect(enLaSuscripcion.periodoFin).toBe(esperado)
    }
  })

  it('la cantidad del renglón son los asientos', () => {
    const i = interpretarEvento(suscripcion())
    expect(i.tipo).toBe('aplicar')
    if (i.tipo === 'aplicar') {
      expect(i.cambio.asientos).toBe(4)
      expect(i.cambio.plan).toBe('despacho')
      expect(i.cambio.estado).toBe('activa')
    }
  })

  it('un borrado cancela aunque el objeto traiga el estado viejo', () => {
    const i = interpretarEvento({
      ...suscripcion({ status: 'active' }),
      type: 'customer.subscription.deleted',
    })
    expect(i.tipo).toBe('aplicar')
    if (i.tipo === 'aplicar') {
      expect(i.cambio.estado).toBe('cancelada')
      expect(i.cambio.plan).toBe('gratuito')
      expect(i.cambio.expedientesTope).toBe(10)
    }
  })

  it('un cobro fallido baja a morosa sin quitar asientos', () => {
    const i = interpretarEvento(suscripcion({ status: 'past_due' }))
    if (i.tipo === 'aplicar') {
      expect(i.cambio.estado).toBe('morosa')
      expect(i.cambio.asientos).toBe(4)
      expect(i.cambio.expedientesTope).toBeNull()
    }
  })

  it('marca la cancelación programada', () => {
    const i = interpretarEvento(suscripcion({ cancel_at_period_end: true }))
    if (i.tipo === 'aplicar') expect(i.cancelaAlFin).toBe(true)
  })

  it('ignora lo que no escucha y lo que llega roto', () => {
    expect(interpretarEvento({ type: 'invoice.paid', data: { object: {} } }).tipo).toBe(
      'ignorar',
    )
    expect(interpretarEvento(null).tipo).toBe('ignorar')
    expect(interpretarEvento({ type: 'customer.subscription.updated' }).tipo).toBe(
      'ignorar',
    )
    expect(
      interpretarEvento({
        type: 'checkout.session.completed',
        data: { object: { mode: 'payment', customer: 'cus_1' } },
      }).tipo,
    ).toBe('ignorar')
  })
})

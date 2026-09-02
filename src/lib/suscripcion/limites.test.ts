import { describe, expect, it } from 'vitest'

import {
  ACCIONES_TOPADAS,
  TOPES_POR_PLAN,
  asientosASugerir,
  asientosLibres,
  avisoDeExcedido,
  cambioDesdeStripe,
  estadoDesdeStripe,
  excedido,
  expedientesLibres,
  planDesdeStripe,
  puedeAbrirExpediente,
  puedeSumarAsiento,
  topeAplicaA,
  validarAsientos,
  type AccionDelDespacho,
  type Consumo,
  type Suscripcion,
} from './limites'

function gratuito(over: Partial<Suscripcion> = {}): Suscripcion {
  return {
    plan: 'gratuito',
    estado: 'gratuita',
    asientos: 1,
    expedientesTope: 10,
    periodoFin: null,
    cancelaAlFin: false,
    tieneCliente: false,
    ...over,
  }
}

function pagado(over: Partial<Suscripcion> = {}): Suscripcion {
  return {
    plan: 'despacho',
    estado: 'activa',
    asientos: 4,
    expedientesTope: null,
    periodoFin: '2026-10-03T00:00:00.000Z',
    cancelaAlFin: false,
    tieneCliente: true,
    ...over,
  }
}

function uso(over: Partial<Consumo> = {}): Consumo {
  return {
    asientosOcupados: 1,
    invitacionesPendientes: 0,
    expedientesActivos: 0,
    ...over,
  }
}

describe('qué se topa y qué no', () => {
  it('solo topa abrir expediente y sumar asiento', () => {
    expect([...ACCIONES_TOPADAS].sort()).toEqual([
      'abrir_expediente',
      'sumar_asiento',
    ])
  })

  /**
   * La prueba que protege la regla de la casa: nada de lo que hace un litigante
   * con un término encima puede depender de que la tarjeta haya pasado.
   */
  it('no topa nada de lo que salva un término', () => {
    const jamas: AccionDelDespacho[] = [
      'computar_plazo',
      'cerrar_plazo',
      'asentar_actuacion',
      'subir_documento',
      'agendar_audiencia',
      'mover_etapa',
      'verificar_catalogo',
      'dar_acceso_al_cliente',
      'recibir_alertas',
      'leer_expediente',
    ]
    for (const accion of jamas) {
      expect(topeAplicaA(accion), accion).toBe(false)
    }
  })
})

describe('expedientes', () => {
  it('deja abrir mientras haya cupo, y no avisa desde el primero', () => {
    const v = puedeAbrirExpediente(gratuito(), uso({ expedientesActivos: 2 }))
    expect(v.permitido).toBe(true)
    if (v.permitido) {
      expect(v.restantes).toBe(8)
      expect(v.aviso).toBeNull()
    }
  })

  it('avisa cuando ya se ve el fondo', () => {
    const v = puedeAbrirExpediente(gratuito(), uso({ expedientesActivos: 9 }))
    expect(v.permitido).toBe(true)
    if (v.permitido) expect(v.aviso).toBe('Te queda 1 expediente en tu plan.')
  })

  it('en el tope no deja abrir, y dice cómo salir sin borrar nada', () => {
    const v = puedeAbrirExpediente(gratuito(), uso({ expedientesActivos: 10 }))
    expect(v.permitido).toBe(false)
    if (!v.permitido) {
      expect(v.motivo).toContain('10 expedientes activos')
      expect(v.salida).toContain('Concluye o archiva')
      expect(v.salida).toContain('no se borra nada')
    }
  })

  it('el plan de paga no tiene tope de expedientes', () => {
    const v = puedeAbrirExpediente(pagado(), uso({ expedientesActivos: 480 }))
    expect(v.permitido).toBe(true)
    if (v.permitido) expect(v.restantes).toBeNull()
    expect(expedientesLibres(pagado(), uso())).toBeNull()
  })
})

describe('asientos', () => {
  it('el titular solo ocupa el único asiento del gratuito', () => {
    expect(asientosLibres(gratuito(), uso())).toBe(0)
    const v = puedeSumarAsiento(gratuito(), uso())
    expect(v.permitido).toBe(false)
    if (!v.permitido) expect(v.salida).toContain('Suma asientos')
  })

  it('las invitaciones sin contestar ya ocupan asiento', () => {
    const consumo = uso({ asientosOcupados: 2, invitacionesPendientes: 2 })
    const v = puedeSumarAsiento(pagado(), consumo)
    expect(v.permitido).toBe(false)
    if (!v.permitido) {
      expect(v.motivo).toContain('2 invitaciones sin contestar')
      expect(v.salida).toContain('Revoca una invitación pendiente')
    }
  })

  it('avisa en el último asiento', () => {
    const v = puedeSumarAsiento(pagado(), uso({ asientosOcupados: 3 }))
    expect(v.permitido).toBe(true)
    if (v.permitido) expect(v.aviso).toBe('Es el último asiento de tu plan.')
  })

  it('el cliente del portal no ocupa asiento', () => {
    // `Consumo.asientosOcupados` lo cuenta la base excluyendo el rol cliente
    // (`contar_asientos_ocupados`, 0012). Aquí se fija la expectativa: un
    // despacho de una persona con tres clientes en el portal sigue en 1.
    const consumo = uso({ asientosOcupados: 1 })
    expect(asientosLibres(pagado(), consumo)).toBe(3)
  })
})

describe('quedarse por encima del tope', () => {
  const caido = gratuito({ estado: 'cancelada' })
  const consumo = uso({
    asientosOcupados: 4,
    expedientesActivos: 32,
  })

  it('mide por cuánto se pasó', () => {
    expect(excedido(caido, consumo)).toEqual({ asientos: 3, expedientes: 22 })
  })

  it('no hay excedido cuando todo cabe', () => {
    expect(excedido(pagado(), uso())).toBeNull()
  })

  /** Nada se suspende y nada se esconde: se pierde crecer, no lo que existe. */
  it('el aviso promete explícitamente que no se tocó nada', () => {
    const e = excedido(caido, consumo)
    expect(e).not.toBeNull()
    const texto = avisoDeExcedido(e!)
    expect(texto).toContain('No se suspendió a nadie ni se archivó nada')
    expect(texto).toContain('22 expedientes activos por encima del tope')
    expect(texto).toContain('3 asientos de más')
  })
})

describe('cuántos asientos contratar', () => {
  it('propone los que ya están comprometidos, nunca menos de uno', () => {
    expect(asientosASugerir(uso({ asientosOcupados: 0 }))).toBe(1)
    expect(
      asientosASugerir(uso({ asientosOcupados: 3, invitacionesPendientes: 2 })),
    ).toBe(5)
  })

  it('no deja contratar menos asientos que gente adentro', () => {
    const consumo = uso({ asientosOcupados: 3, invitacionesPendientes: 1 })
    expect(validarAsientos(2, consumo)).toContain('al menos esa cantidad')
    expect(validarAsientos(4, consumo)).toBeNull()
  })

  it('rechaza cantidades que no son cantidades', () => {
    expect(validarAsientos(0, uso())).not.toBeNull()
    expect(validarAsientos(2.5, uso())).not.toBeNull()
    expect(validarAsientos(500, uso())).not.toBeNull()
  })
})

describe('lo que manda Stripe', () => {
  it('traduce los estados', () => {
    expect(estadoDesdeStripe('active')).toBe('activa')
    expect(estadoDesdeStripe('trialing')).toBe('activa')
    expect(estadoDesdeStripe('past_due')).toBe('morosa')
    expect(estadoDesdeStripe('unpaid')).toBe('morosa')
    expect(estadoDesdeStripe('canceled')).toBe('cancelada')
  })

  /** Un cobro fallido no puede dejar a nadie sin poder registrar un plazo. */
  it('un cobro fallido conserva el plan de paga', () => {
    expect(planDesdeStripe('past_due')).toBe('despacho')
    const cambio = cambioDesdeStripe('past_due', 4)
    expect(cambio.asientos).toBe(4)
    expect(cambio.expedientesTope).toBeNull()
  })

  it('un estado desconocido no apaga nada por sí solo', () => {
    expect(estadoDesdeStripe('lo_que_stripe_invente')).toBe('morosa')
    expect(planDesdeStripe('lo_que_stripe_invente')).toBe('despacho')
  })

  it('cancelar devuelve al gratuito CON sus topes, no sin tope', () => {
    const cambio = cambioDesdeStripe('canceled', 7)
    expect(cambio).toEqual({
      plan: 'gratuito',
      estado: 'cancelada',
      asientos: TOPES_POR_PLAN.gratuito.asientos,
      expedientesTope: TOPES_POR_PLAN.gratuito.expedientesActivos,
    })
  })

  it('la cantidad de la suscripción es la que manda en los asientos', () => {
    expect(cambioDesdeStripe('active', 9).asientos).toBe(9)
    // Una cantidad rota no puede dejar el despacho en cero asientos: nadie
    // podría entrar, ni siquiera el titular.
    expect(cambioDesdeStripe('active', 0).asientos).toBe(1)
  })
})

import { describe, expect, it } from 'vitest'

import {
  TOLERANCIA_SEGUNDOS,
  firmarComoStripe,
  verificarFirmaStripe,
} from './firma'

const SECRETO = 'whsec_de_prueba_no_sirve_para_nada'
const CUERPO = JSON.stringify({ id: 'evt_1', type: 'customer.subscription.updated' })
const AHORA = Date.UTC(2026, 8, 3, 12, 0, 0)
const MARCA = Math.floor(AHORA / 1000)

function verificar(over: Partial<Parameters<typeof verificarFirmaStripe>[0]> = {}) {
  return verificarFirmaStripe({
    cuerpo: CUERPO,
    encabezado: firmarComoStripe(CUERPO, SECRETO, MARCA),
    secreto: SECRETO,
    ahora: AHORA,
    ...over,
  })
}

describe('firma de Stripe', () => {
  it('acepta un evento firmado y reciente', () => {
    expect(verificar()).toEqual({ ok: true })
  })

  it('rechaza cuando el cuerpo cambió aunque sea un byte', () => {
    const r = verificar({ cuerpo: `${CUERPO} ` })
    expect(r.ok).toBe(false)
  })

  it('rechaza una firma hecha con otro secreto', () => {
    const r = verificar({
      encabezado: firmarComoStripe(CUERPO, 'whsec_del_atacante', MARCA),
    })
    expect(r.ok).toBe(false)
  })

  /** Un evento legítimo, capturado y reenviado el mes que viene. */
  it('rechaza el reenvío de un evento viejo, aunque su firma sea buena', () => {
    const viejo = MARCA - TOLERANCIA_SEGUNDOS - 1
    const r = verificar({ encabezado: firmarComoStripe(CUERPO, SECRETO, viejo) })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('antigüedad')
  })

  it('ignora el esquema v0 de prueba', () => {
    const soloV0 = `t=${MARCA},v0=${'a'.repeat(64)}`
    const r = verificar({ encabezado: soloV0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.motivo).toContain('firma v1')
  })

  it('acepta cuando una de varias firmas coincide (rotación del secreto)', () => {
    const buena = firmarComoStripe(CUERPO, SECRETO, MARCA)
    const revuelto = `t=${MARCA},v1=${'0'.repeat(64)},${buena.split(',')[1]}`
    expect(verificar({ encabezado: revuelto })).toEqual({ ok: true })
  })

  it('sin encabezado y sin secreto falla cerrado', () => {
    expect(verificar({ encabezado: null }).ok).toBe(false)
    expect(verificar({ secreto: '' }).ok).toBe(false)
  })
})

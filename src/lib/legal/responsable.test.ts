import { describe, expect, it } from 'vitest'

import {
  DATOS_QUE_SE_TRATAN,
  ENCARGADOS,
  LO_QUE_NO_SE_HACE,
} from './tratamiento'
import {
  RESPONSABLE,
  datosPendientes,
  esBorrador,
  frenteAlIva,
  nombreDelResponsable,
  type Responsable,
} from './responsable'

const COMPLETO: Responsable = {
  razonSocial: 'Despacho de Prueba, S.C.',
  domicilio: 'Calle Falsa 123, Ciudad de México',
  correoPrivacidad: 'privacidad@ejemplo.mx',
  jurisdiccion: 'Ciudad de México',
}

describe('datos que un documento legal no puede inventar', () => {
  /**
   * La prueba que sostiene la decisión: hoy no hay razón social ni domicilio, y
   * el sistema tiene que comportarse como lo que es —un borrador— en vez de
   * publicar un aviso de privacidad con datos de relleno.
   */
  it('hoy los documentos son borrador, porque faltan los datos del responsable', () => {
    expect(esBorrador()).toBe(true)
    expect(datosPendientes()).toContain('el domicilio del responsable')
    expect(datosPendientes()).toContain(
      'el correo para las solicitudes de derechos ARCO',
    )
  })

  it('con todo lleno y el IVA decidido, dejan de ser borrador', () => {
    expect(datosPendientes(COMPLETO, 'adicional')).toEqual([])
    expect(esBorrador(COMPLETO, 'adicional')).toBe(false)
  })

  it('falta el IVA aunque los demás datos estén', () => {
    expect(datosPendientes(COMPLETO, null)).toEqual([
      'si el precio lleva IVA incluido o por encima',
    ])
    expect(esBorrador(COMPLETO, null)).toBe(true)
  })

  it('un dato en blancos cuenta como faltante', () => {
    expect(datosPendientes({ ...COMPLETO, domicilio: '   ' }, 'incluido')).toEqual([
      'el domicilio del responsable',
    ])
  })

  /** Decir "más IVA" cuando se cobró con IVA incluido es un 16 % de diferencia. */
  it('no se escribe nada del IVA mientras no se decida', () => {
    expect(frenteAlIva(null)).toBeNull()
    expect(frenteAlIva('incluido')).toContain('ya incluyen')
    expect(frenteAlIva('adicional')).toContain('se les suma')
  })

  it('el nombre del responsable no deja un hueco en la frase', () => {
    expect(nombreDelResponsable(RESPONSABLE)).toBe('el responsable de Litis')
    expect(nombreDelResponsable(COMPLETO)).toBe('Despacho de Prueba, S.C.')
  })
})

describe('inventario del tratamiento', () => {
  it('cada grupo de datos dice para qué se trata y de dónde sale', () => {
    expect(DATOS_QUE_SE_TRATAN.length).toBeGreaterThan(0)
    for (const g of DATOS_QUE_SE_TRATAN) {
      expect(g.paraQue.length, g.quien).toBeGreaterThan(20)
      expect(g.donde.length, g.quien).toBeGreaterThan(0)
    }
  })

  /**
   * Un aviso que dice "compartimos datos con proveedores" no informa de nada.
   * Cada encargado va con nombre y con el país donde procesa, porque los tres
   * están fuera de México y eso hay que decirlo.
   */
  it('cada encargado va con nombre y con dónde procesa', () => {
    expect(ENCARGADOS.map((e) => e.nombre)).toEqual(['Supabase', 'Stripe', 'Resend'])
    for (const e of ENCARGADOS) {
      expect(e.donde.length, e.nombre).toBeGreaterThan(0)
      expect(e.paraQue.length, e.nombre).toBeGreaterThan(20)
    }
  })

  it('la lista de lo que no se hace incluye no entrenar modelos con los expedientes', () => {
    expect(LO_QUE_NO_SE_HACE.join(' ')).toContain('entrenar modelos')
    expect(LO_QUE_NO_SE_HACE.join(' ')).toContain('No se venden')
  })
})

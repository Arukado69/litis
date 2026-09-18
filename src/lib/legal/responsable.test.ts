import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import {
  DATOS_QUE_SE_TRATAN,
  ENCARGADOS,
  LO_QUE_NO_SE_HACE,
} from './tratamiento'
import {
  HUELLA_DATOS,
  HUELLA_VIGENTE,
  IVA,
  RESPONSABLE,
  VIGENCIA,
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

describe('la fecha de vigencia no se queda atrás', () => {
  /**
   * ⚠️ La cláusula 12 de los términos promete que «si estos términos cambian, la
   * fecha de arriba lo refleja». Esa promesa es de las pocas de estas páginas
   * que se puede comprobar sin ser abogado, así que se comprueba.
   *
   * Ya falló: la cláusula 11 se reescribió al construir la exportación del
   * despacho y `VIGENCIA` se quedó una semana atrás. El documento se desmentía
   * a sí mismo y nada lo dijo, porque nada lo estaba mirando.
   *
   * Cuando esta prueba falle, el arreglo NO es copiar el hash nuevo: es
   * preguntarse si el cambio movió lo que el documento promete y poner la fecha
   * del día en que se movió. El hash vive pegado a `VIGENCIA` justamente para
   * que al venir a tocarlo se vea la fecha.
   */
  it('la huella de los documentos corresponde a la fecha declarada', () => {
    for (const [archivo, esperada] of Object.entries(HUELLA_VIGENTE)) {
      const contenido = readFileSync(archivo)
      const actual = createHash('sha256').update(contenido).digest('hex').slice(0, 16)
      expect(
        actual,
        `${archivo} cambió desde la vigencia declarada (${VIGENCIA}). ` +
          '¿El cambio movió lo que el documento promete? Actualiza VIGENCIA y esta huella.',
      ).toBe(esperada)
    }
  })

  /** Una huella sobre un archivo que ya no existe no vigila nada. */
  it('vigila los tres documentos que se publican', () => {
    expect(Object.keys(HUELLA_VIGENTE)).toHaveLength(3)
    for (const archivo of Object.keys(HUELLA_VIGENTE)) {
      expect(existsSync(archivo), archivo).toBe(true)
    }
  })
})

describe('los datos impresos también cuentan', () => {
  /**
   * ⚠️ La mayor parte del texto publicado no vive en los archivos de las
   * páginas: la razón social, el domicilio, el correo ARCO, la jurisdicción y la
   * frase del IVA salen de `responsable.ts`. Cambiar cualquiera de ellos mueve
   * lo que el documento dice sin tocar un byte de `page.tsx` — así que el hash
   * de archivos, solo, dejaría pasar justo lo que más cambia.
   */
  it('la huella de los datos corresponde a la fecha declarada', () => {
    const actual = createHash('sha256')
      .update(JSON.stringify({ RESPONSABLE, IVA }))
      .digest('hex')
      .slice(0, 16)

    expect(
      actual,
      `Los datos del responsable o el trato del IVA cambiaron desde ${VIGENCIA}. ` +
        'Actualiza VIGENCIA y HUELLA_DATOS.',
    ).toBe(HUELLA_DATOS)
  })
})

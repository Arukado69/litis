import { describe, expect, it } from 'vitest'

import {
  ESTADO_ETIQUETA,
  avisoDePlazosAfectados,
  corrigeElComputo,
  estadoDeEntrada,
  leerVerificacion,
  resolverCatalogo,
  resumenDelCatalogo,
  validarVerificacion,
  type EntradaDelCatalogo,
} from './verificacion'

function entrada(over: Partial<EntradaDelCatalogo> = {}): EntradaDelCatalogo {
  return {
    id: 'e1',
    despachoId: null,
    clave: 'merc.contestacion.ordinario',
    regimen: 'mercantil',
    etiqueta: 'Contestación de demanda — ordinario mercantil',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1378',
    nota: null,
    verificadoPor: null,
    verificadoEl: null,
    verificacionNotas: null,
    ...over,
  }
}

const SEMILLA = entrada()

describe('estadoDeEntrada', () => {
  it('la compartida siempre está sin verificar', () => {
    // Que un despacho la revise no puede volverla verificada para los demás.
    expect(estadoDeEntrada(SEMILLA, null)).toBe('semilla')
  })

  it('una compartida sigue siendo semilla aunque traiga firma', () => {
    // Defensa contra un dato raro: la procedencia manda sobre la firma.
    expect(
      estadoDeEntrada(
        entrada({ verificadoEl: '2026-09-01T00:00:00Z', verificadoPor: 'x' }),
        null,
      ),
    ).toBe('semilla')
  })

  it('adoptada tal cual es "verificada"', () => {
    const propia = entrada({ id: 'p1', despachoId: 'd1' })
    expect(estadoDeEntrada(propia, SEMILLA)).toBe('verificada')
  })

  it('adoptada con otros días es "corregida"', () => {
    // "La revisé y estaba bien" no es lo mismo que "la revisé y decía 15 donde
    // son 9".
    const propia = entrada({ id: 'p1', despachoId: 'd1', dias: 9 })
    expect(estadoDeEntrada(propia, SEMILLA)).toBe('corregida')
  })

  it('cambiar la unidad también es corregir', () => {
    const propia = entrada({ id: 'p1', despachoId: 'd1', unidad: 'naturales' })
    expect(estadoDeEntrada(propia, SEMILLA)).toBe('corregida')
  })

  it('cambiar el fundamento también', () => {
    const propia = entrada({
      id: 'p1',
      despachoId: 'd1',
      fundamento: 'CNPCyF, art. 255',
    })
    expect(estadoDeEntrada(propia, SEMILLA)).toBe('corregida')
  })

  it('un espacio de más en el fundamento no es una corrección', () => {
    const propia = entrada({
      id: 'p1',
      despachoId: 'd1',
      fundamento: '  Código de Comercio, art. 1378 ',
    })
    expect(estadoDeEntrada(propia, SEMILLA)).toBe('verificada')
  })

  it('sin clave, es del despacho y punto', () => {
    const propia = entrada({ id: 'p1', despachoId: 'd1', clave: null })
    expect(estadoDeEntrada(propia, null)).toBe('propia')
  })

  it('con clave pero sin semilla que la respalde, también', () => {
    // Pasa cuando la semilla se renombró o se retiró.
    const propia = entrada({ id: 'p1', despachoId: 'd1' })
    expect(estadoDeEntrada(propia, null)).toBe('propia')
  })
})

describe('resolverCatalogo', () => {
  it('sin adopciones, devuelve las compartidas', () => {
    const resueltas = resolverCatalogo([SEMILLA])
    expect(resueltas).toHaveLength(1)
    expect(resueltas[0]?.estado).toBe('semilla')
  })

  it('la propia SUSTITUYE a la compartida de la misma clave', () => {
    // Sin esto el selector enseñaría el mismo término dos veces —uno verificado
    // y otro no— y quien capture elegiría cualquiera.
    const propia = entrada({ id: 'p1', despachoId: 'd1', dias: 9 })
    const resueltas = resolverCatalogo([SEMILLA, propia])
    expect(resueltas).toHaveLength(1)
    expect(resueltas[0]?.entrada.id).toBe('p1')
    expect(resueltas[0]?.estado).toBe('corregida')
  })

  it('la resuelta conserva de qué semilla salió, para enseñar el antes', () => {
    const propia = entrada({ id: 'p1', despachoId: 'd1', dias: 9 })
    const resueltas = resolverCatalogo([SEMILLA, propia])
    expect(resueltas[0]?.semilla?.dias).toBe(15)
  })

  it('no toca las de claves distintas', () => {
    const otra = entrada({ id: 'e2', clave: 'merc.apelacion', etiqueta: 'Apelación' })
    const propia = entrada({ id: 'p1', despachoId: 'd1' })
    expect(resolverCatalogo([SEMILLA, otra, propia])).toHaveLength(2)
  })

  it('las capturadas a mano nunca desplazan a nadie', () => {
    const aMano = entrada({
      id: 'm1',
      despachoId: 'd1',
      clave: null,
      etiqueta: 'Recurso local raro',
    })
    expect(resolverCatalogo([SEMILLA, aMano])).toHaveLength(2)
  })

  it('sale ordenado por etiqueta', () => {
    const a = entrada({ id: 'a', clave: 'z', etiqueta: 'Zaguán' })
    const b = entrada({ id: 'b', clave: 'a', etiqueta: 'Alegatos' })
    expect(resolverCatalogo([a, b]).map((r) => r.entrada.id)).toEqual(['b', 'a'])
  })
})

describe('resumenDelCatalogo', () => {
  it('cuenta cada estado', () => {
    const propia = entrada({ id: 'p1', despachoId: 'd1' })
    const otra = entrada({ id: 'e2', clave: 'merc.apelacion', etiqueta: 'Apelación' })
    const cuenta = resumenDelCatalogo(resolverCatalogo([SEMILLA, propia, otra]))
    expect(cuenta.verificada).toBe(1)
    expect(cuenta.semilla).toBe(1)
    expect(cuenta.corregida).toBe(0)
  })

  it('todos los estados tienen etiqueta', () => {
    for (const estado of Object.keys(ESTADO_ETIQUETA)) {
      expect(ESTADO_ETIQUETA[estado as keyof typeof ESTADO_ETIQUETA]).toBeTruthy()
    }
  })
})

describe('leerVerificacion', () => {
  it('lee lo que manda el formulario', () => {
    const leida = leerVerificacion({
      dias: '9',
      unidad: 'naturales',
      fundamento: ' CNPCyF, art. 255 ',
      notas: 'Revisado contra el texto vigente al 1 de septiembre de 2026.',
    })
    expect(leida.dias).toBe(9)
    expect(leida.unidad).toBe('naturales')
    expect(leida.fundamento).toBe('CNPCyF, art. 255')
  })

  it('rechaza días que no son enteros positivos', () => {
    for (const malo of ['0', '-3', '2.5', 'quince', '']) {
      expect(leerVerificacion({ dias: malo }).dias).toBeNull()
    }
  })

  it('una unidad inventada cae en hábiles', () => {
    expect(leerVerificacion({ unidad: 'lunas' }).unidad).toBe('habiles')
  })
})

describe('validarVerificacion', () => {
  const buena = leerVerificacion({
    dias: '15',
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1378',
    notas: 'Revisado contra el texto vigente al 1 de septiembre de 2026.',
  })

  it('acepta una verificación completa', () => {
    expect(validarVerificacion(buena)).toEqual([])
  })

  it('exige días válidos', () => {
    expect(validarVerificacion({ ...buena, dias: null }).map((p) => p.campo)).toContain(
      'dias',
    )
  })

  it('exige fundamento', () => {
    expect(
      validarVerificacion({ ...buena, fundamento: 'art' }).map((p) => p.campo),
    ).toContain('fundamento')
  })

  it('exige la nota de contra qué se revisó', () => {
    // Sin eso, "verificado" no significa nada dentro de seis meses.
    for (const nota of ['', 'ok', 'ya revisé']) {
      expect(
        validarVerificacion({ ...buena, notas: nota }).map((p) => p.campo),
      ).toContain('notas')
    }
  })
})

describe('corrigeElComputo', () => {
  const original = { dias: 15, unidad: 'habiles' }

  it('confirmar tal cual no corrige nada', () => {
    expect(
      corrigeElComputo(leerVerificacion({ dias: '15', unidad: 'habiles' }), original),
    ).toBe(false)
  })

  it('cambiar los días sí', () => {
    expect(
      corrigeElComputo(leerVerificacion({ dias: '9', unidad: 'habiles' }), original),
    ).toBe(true)
  })

  it('cambiar la unidad sí', () => {
    expect(
      corrigeElComputo(leerVerificacion({ dias: '15', unidad: 'naturales' }), original),
    ).toBe(true)
  })

  it('cambiar solo el fundamento NO cambia el cómputo', () => {
    // Corrige el rastro, no la fecha: no hay plazos que revisar por eso.
    expect(
      corrigeElComputo(
        leerVerificacion({ dias: '15', unidad: 'habiles', fundamento: 'Otro' }),
        original,
      ),
    ).toBe(false)
  })
})

describe('avisoDePlazosAfectados', () => {
  it('dice cuántos son y que NO se recalculan solos', () => {
    // Cambiarle la fecha a un plazo sin que nadie lo vea es justo lo que este
    // producto no hace: el abogado ya agendó y quizá ya redactó contra ella.
    const aviso = avisoDePlazosAfectados(
      3,
      { dias: 15, unidad: 'habiles' },
      { dias: 9, unidad: 'habiles' },
    )
    expect(aviso).toContain('3 plazos')
    expect(aviso).toMatch(/no se recalculan solos/i)
    expect(aviso).toContain('15')
    expect(aviso).toContain('9')
  })

  it('el singular se escribe en singular', () => {
    const aviso = avisoDePlazosAfectados(
      1,
      { dias: 15, unidad: 'habiles' },
      { dias: 9, unidad: 'habiles' },
    )
    expect(aviso).toContain('1 plazo corriendo')
    expect(aviso).toMatch(/no se recalcula solo/i)
  })
})

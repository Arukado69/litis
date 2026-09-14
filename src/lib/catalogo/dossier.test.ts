import { describe, expect, it } from 'vitest'

import {
  armarDossier,
  citasImprecisas,
  huecosDeCobertura,
  sinFundamento,
  type EntradaDelCatalogo,
  type ViaDelSistema,
} from './dossier'

function entrada(over: Partial<EntradaDelCatalogo> = {}): EntradaDelCatalogo {
  return {
    id: 'e-1',
    clave: 'merc.contestacion.ordinario',
    regimen: 'mercantil',
    etiqueta: 'Contestación — ordinario mercantil',
    dias: 15,
    unidad: 'habiles',
    fundamento: 'Código de Comercio, art. 1378',
    nota: null,
    verificado_el: null,
    ...over,
  }
}

const VIAS: ViaDelSistema[] = [
  { id: 'merc.ordinario', nombre: 'Ordinario mercantil', regimen: 'mercantil' },
  { id: 'civ.ordinario', nombre: 'Ordinario civil', regimen: 'civil_familiar_local' },
  { id: 'fam.divorcio', nombre: 'Divorcio', regimen: 'civil_familiar_local' },
  { id: 'lab.ordinario', nombre: 'Ordinario laboral', regimen: 'laboral' },
]

describe('huecos de cobertura', () => {
  it('encuentra las vías que no ofrecen un solo plazo', () => {
    const huecos = huecosDeCobertura(VIAS, [entrada()])

    expect(huecos.map((h) => h.regimen)).toEqual([
      'civil_familiar_local',
      'laboral',
    ])
    // El más grande primero: es por donde conviene empezar.
    expect(huecos[0]?.vias).toHaveLength(2)
  })

  /**
   * ⚠️ Se mide contra las VÍAS, no contra la lista de regímenes. Un régimen que
   * nadie puede elegir al abrir un expediente no le falta a nadie, y contarlo
   * como hueco mandaría a verificar plazos que ningún asunto va a usar.
   */
  it('un régimen que nadie puede elegir no es un hueco', () => {
    const soloMercantil: ViaDelSistema[] = [VIAS[0]!]
    expect(huecosDeCobertura(soloMercantil, [entrada()])).toEqual([])
  })

  it('sin huecos cuando todo régimen elegible tiene su plazo', () => {
    const cubiertas = huecosDeCobertura(VIAS, [
      entrada(),
      entrada({ regimen: 'civil_familiar_local' }),
      entrada({ regimen: 'laboral' }),
    ])
    expect(cubiertas).toEqual([])
  })
})

describe('citas que no alcanzan para verificar', () => {
  /**
   * El caso real de la semilla: tres recursos mercantiles de 9, 6 y 3 días
   * señalando el mismo artículo. Ese artículo distingue por fracción y la cita
   * no dice cuál.
   */
  it('caza el mismo artículo con plazos distintos', () => {
    const imprecisas = citasImprecisas([
      entrada({ etiqueta: 'Apelación', dias: 9, fundamento: 'CCom, art. 1079' }),
      entrada({ etiqueta: 'Apelación interlocutoria', dias: 6, fundamento: 'CCom, art. 1079' }),
      entrada({ etiqueta: 'Revocación', dias: 3, fundamento: 'CCom, art. 1079' }),
    ])

    expect(imprecisas).toHaveLength(1)
    expect(imprecisas[0]?.fundamento).toBe('CCom, art. 1079')
    expect(imprecisas[0]?.entradas.map((e) => e.dias)).toEqual([9, 6, 3])
  })

  /** Dos entradas del mismo artículo con el MISMO plazo no tienen problema. */
  it('el mismo artículo con el mismo plazo no se reporta', () => {
    expect(
      citasImprecisas([
        entrada({ etiqueta: 'Amparo indirecto', dias: 15, fundamento: 'LA, art. 17' }),
        entrada({ etiqueta: 'Amparo directo', dias: 15, fundamento: 'LA, art. 17' }),
      ]),
    ).toEqual([])
  })

  it('no confunde una cita ausente con una repetida', () => {
    expect(
      citasImprecisas([
        entrada({ dias: 9, fundamento: null }),
        entrada({ dias: 6, fundamento: '  ' }),
      ]),
    ).toEqual([])
  })
})

describe('entradas sin fundamento', () => {
  it('las separa, porque no hay contra qué cotejarlas', () => {
    const huerfanas = sinFundamento([
      entrada(),
      entrada({ etiqueta: 'Capturada a mano', fundamento: null }),
      entrada({ etiqueta: 'Con espacios', fundamento: '   ' }),
    ])
    expect(huerfanas.map((e) => e.etiqueta)).toEqual([
      'Capturada a mano',
      'Con espacios',
    ])
  })
})

describe('el documento', () => {
  const dossier = armarDossier({
    entradas: [
      entrada({ dias: 9, fundamento: 'CCom, art. 1079', etiqueta: 'Apelación' }),
      entrada({ dias: 3, fundamento: 'CCom, art. 1079', etiqueta: 'Revocación' }),
    ],
    vias: VIAS,
    generadoEl: '2026-09-14',
    proyecto: 'wtugxkmkaxaueuwweqhx',
  })

  /**
   * ⚠️ La prueba que importa. Un documento de apoyo que propone plazos es un
   * catálogo sin verificar disfrazado de revisión: quien lo lea de prisa se
   * lleva el número y firma. Aquí no puede haber un número que no venga de la
   * base.
   */
  it('dice en voz alta que no verifica nada', () => {
    expect(dossier).toMatch(/no verifica nada/i)
    expect(dossier).toMatch(/no propone plazos/i)
  })

  it('pone los huecos de cobertura antes que las entradas', () => {
    const huecos = dossier.indexOf('vías que no tienen ni un plazo')
    const entradas = dossier.indexOf('Entrada por entrada')
    expect(huecos).toBeGreaterThan(-1)
    expect(huecos).toBeLessThan(entradas)
  })

  it('deja el hueco de la nota de verificación en cada entrada', () => {
    expect(dossier.match(/Nota de verificación/g)).toHaveLength(2)
  })

  it('reporta la cita imprecisa con sus dos plazos', () => {
    expect(dossier).toMatch(/9 días habiles — Apelación/)
    expect(dossier).toMatch(/3 días habiles — Revocación/)
  })
})

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CALENDARIOS_SEMILLA } from './calendarios-semilla'
import { VIAS } from '@/lib/expedientes/materias'

import { CATALOGO_PLAZOS, REGIMENES_SIN_CATALOGO } from './catalogo'

/**
 * Guardia contra la deriva entre el código y la migración de semilla.
 *
 * La migración `0008` se GENERA desde estas constantes. En cuanto alguien
 * agregue un feriado o un plazo en TypeScript sin regenerarla, la base y el
 * código dirán cosas distintas — y como el motor computa con lo que hay en la
 * base, el cómputo dejaría de corresponder a lo que dice el catálogo que el
 * despacho cree tener verificado.
 *
 * Estas pruebas no comparan el SQL palabra por palabra: comparan que cada
 * entrada del código aparezca en el archivo. Es suficiente para que el olvido
 * salte, y no se rompe con un cambio de formato.
 */

const SQL = readFileSync(
  new URL(
    '../../../supabase/migrations/0008_semilla_calendarios_plazos.sql',
    import.meta.url,
  ),
  'utf8',
)

/** Como el generador: comilla simple duplicada. */
function comoSql(valor: string): string {
  return valor.replace(/'/g, "''")
}

describe('la migración de semilla no se ha separado del código', () => {
  it('incluye cada calendario', () => {
    for (const c of CALENDARIOS_SEMILLA) {
      expect(SQL, `falta el calendario ${c.id}`).toContain(`'${c.id}'`)
      expect(SQL, `falta el nombre de ${c.id}`).toContain(`'${comoSql(c.nombre)}'`)
    }
  })

  it('incluye cada día inhábil de cada calendario', () => {
    for (const c of CALENDARIOS_SEMILLA) {
      for (const p of c.periodos) {
        expect(
          SQL,
          `falta ${p.descripcion} (${p.desde}) de ${c.id}`,
        ).toContain(`'${comoSql(p.descripcion)}'`)
        expect(SQL, `falta la fecha ${p.desde}`).toContain(`'${p.desde}'`)
      }
    }
  })

  it('incluye cada plazo del catálogo con su duración', () => {
    for (const p of CATALOGO_PLAZOS) {
      expect(SQL, `falta el plazo ${p.id}`).toContain(`'${p.id}'`)
      expect(SQL, `falta la etiqueta de ${p.id}`).toContain(
        `'${comoSql(p.etiqueta)}'`,
      )
    }
  })

  it('no mete plazos ya verificados', () => {
    // El catálogo tiene que nacer sin verificar. Si la migración escribiera
    // `verificado_por`, el sistema afirmaría algo que nadie revisó.
    expect(SQL).not.toMatch(/verificado_por/)
    expect(SQL).not.toMatch(/verificado_el/)
  })

  it('todo lo semilla es catálogo compartido', () => {
    // `despacho_id` distinto de null aquí significaría que la semilla quedó
    // colgada de un despacho concreto y los demás no la verían.
    const inserts = SQL.match(/insert into public\.(calendarios|plazos_catalogo)/g)
    expect(inserts?.length ?? 0).toBeGreaterThan(0)
    expect(SQL).not.toMatch(/despacho_id\s*=\s*'[0-9a-f-]{36}'/)
  })
})

describe('qué vías se quedan sin catálogo', () => {
  /**
   * ⚠️ El hueco tiene que estar DECLARADO, no descubierto.
   *
   * Hoy 9 de las 18 vías que el sistema ofrece no tienen un solo plazo: las 6
   * de civil/familiar, las 2 laborales y la penal. No es un descuido del
   * catálogo, es la mitad de la promesa del producto apagada para esos
   * asuntos — y se llena cuando un abogado aporte los plazos con su
   * fundamento, no inventándolos.
   *
   * Esta prueba falla en los DOS sentidos, a propósito: agregar una vía de un
   * régimen sin plazos obliga a declararlo, y llenar el catálogo laboral
   * obliga a venir a quitarlo. Una buena noticia que rompe una prueba es
   * barata; un hueco que nadie recuerda, no.
   */
  it('los regímenes sin un solo plazo son exactamente los declarados', () => {
    const conEntradas = new Set(CATALOGO_PLAZOS.map((p) => p.regimen))
    const sinCatalogo = [
      ...new Set(
        VIAS.map((v) => v.regimen).filter((r) => !conEntradas.has(r)),
      ),
    ].sort()

    expect(sinCatalogo).toEqual([...REGIMENES_SIN_CATALOGO].sort())
  })

  /** Lo declarado tiene que ser elegible: declarar un régimen muerto no dice nada. */
  it('todo régimen declarado tiene al menos una vía que lo usa', () => {
    for (const regimen of REGIMENES_SIN_CATALOGO) {
      expect(VIAS.some((v) => v.regimen === regimen), regimen).toBe(true)
    }
  })
})

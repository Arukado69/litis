import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { CALENDARIOS_SEMILLA } from './calendarios-semilla'
import { CATALOGO_PLAZOS } from './catalogo'

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

import { describe, expect, it } from 'vitest'

import type { RolMembresia } from '@/types/db'

import {
  COLUMNAS_OMITIDAS,
  NO_INCLUYE,
  TABLAS_EXPORTADAS,
  armarExportacion,
  nombreDelArchivo,
  puedeExportar,
  tablasDeclaradasEnElAviso,
  totalDeFilas,
  type FilasPorTabla,
} from './exportacion'

const DESPACHO = { id: 'd-1', nombre: 'Despacho Pérez', slug: 'despacho-perez' }
const QUIEN = {
  perfil_id: 'p-1',
  nombre: 'Nadia Pérez',
  correo: 'nadia@despacho.mx',
}
const CUANDO = '2026-09-14T18:30:00.000Z'

/** Todas las tablas vacías, para llenar solo la que interesa a cada prueba. */
function vacias(): FilasPorTabla {
  const filas = {} as FilasPorTabla
  for (const tabla of TABLAS_EXPORTADAS) filas[tabla] = []
  return filas
}

function exportar(over: Partial<FilasPorTabla> = {}) {
  return armarExportacion({
    despacho: DESPACHO,
    generadaPor: QUIEN,
    generadaEl: CUANDO,
    filas: { ...vacias(), ...over },
  })
}

describe('qué entrega la exportación', () => {
  /**
   * La prueba que amarra el aviso de privacidad con lo que se entrega. El aviso
   * publica en qué tabla vive cada grupo de datos; si declarara una tabla que
   * la exportación no trae, el despacho pediría sus datos y recibiría menos de
   * lo que se le dijo que había.
   */
  it('entrega todas las tablas que el aviso de privacidad declara', () => {
    for (const tabla of tablasDeclaradasEnElAviso()) {
      expect(TABLAS_EXPORTADAS).toContain(tabla)
    }
  })

  it('dice adentro qué NO trae', () => {
    const archivo = exportar()
    expect(archivo.no_incluye).toEqual(NO_INCLUYE)
    // El vacío más caro de descubrir tarde: los archivos no van dentro.
    expect(archivo.no_incluye.join(' ')).toMatch(/archivos de los documentos/i)
  })

  it('el conteo sale de las filas, no se pasa aparte', () => {
    const archivo = exportar({
      expedientes: [{ id: 'e-1' }, { id: 'e-2' }, { id: 'e-3' }],
      personas: [{ id: 'per-1' }],
    })

    expect(archivo.conteo.expedientes).toBe(3)
    expect(archivo.conteo.personas).toBe(1)
    expect(archivo.conteo.actuaciones).toBe(0)
    expect(totalDeFilas(archivo)).toBe(4)
  })

  it('trae todas las tablas aunque estén vacías', () => {
    const archivo = exportar()
    for (const tabla of TABLAS_EXPORTADAS) {
      expect(archivo.datos[tabla]).toEqual([])
      expect(archivo.conteo[tabla]).toBe(0)
    }
  })
})

describe('lo que se tacha', () => {
  /**
   * Regla 14. La huella del token es la llave de un despacho entero y este
   * archivo se manda por correo: no tiene nada que hacer aquí.
   */
  it('el hash del token de invitación NO sale', () => {
    const archivo = exportar({
      invitaciones: [
        {
          id: 'i-1',
          correo: 'danny@despacho.mx',
          token_hash: 'a9f3c1e8b7d6' + '0'.repeat(52),
          estado: 'pendiente',
        },
      ],
    })

    const invitacion = archivo.datos.invitaciones[0]
    expect(invitacion).toBeDefined()
    expect(invitacion).not.toHaveProperty('token_hash')
    // Lo demás de la invitación sí se lleva: es suyo.
    expect(invitacion).toMatchObject({ correo: 'danny@despacho.mx' })
  })

  /**
   * ⚠️ La prueba que de verdad protege: el tachado vive en el armado, así que
   * una consulta nueva escrita con `select('*')` no puede colar la columna.
   * Se busca sobre el JSON serializado —que es lo que se descarga— y no sobre
   * el objeto, porque lo que se filtra es el archivo.
   */
  it('ninguna columna omitida sobrevive al archivo, venga de donde venga', () => {
    const archivo = exportar({
      invitaciones: [{ id: 'i-1', token_hash: 'ESTO-NO-DEBE-APARECER' }],
    })

    const json = JSON.stringify(archivo.datos)
    expect(json).not.toContain('ESTO-NO-DEBE-APARECER')

    for (const [tabla, columnas] of Object.entries(COLUMNAS_OMITIDAS)) {
      for (const columna of columnas ?? []) {
        for (const fila of archivo.datos[tabla as keyof typeof archivo.datos]) {
          expect(Object.keys(fila)).not.toContain(columna)
        }
      }
    }
  })

  it('deja intactas las filas de las tablas que no tachan nada', () => {
    const persona = { id: 'per-1', nombre: 'Constructora XYZ', rfc: 'CXY010101AAA' }
    const archivo = exportar({ personas: [persona] })
    expect(archivo.datos.personas[0]).toEqual(persona)
  })
})

describe('el nombre del archivo', () => {
  it('lleva el despacho y el día', () => {
    expect(nombreDelArchivo('despacho-perez', CUANDO)).toBe(
      'litis-despacho-perez-2026-09-14.json',
    )
  })

  /** El slug sale de la base, pero un nombre de archivo no se arma con lo que venga. */
  it('no deja que el slug se salga del nombre', () => {
    expect(nombreDelArchivo('../../etc/passwd', CUANDO)).toBe(
      'litis-etcpasswd-2026-09-14.json',
    )
    expect(nombreDelArchivo('', CUANDO)).toBe('litis-despacho-2026-09-14.json')
  })
})

describe('quién la descarga', () => {
  it('solo el titular', () => {
    expect(puedeExportar('titular')).toBe(true)
  })

  /**
   * ⚠️ El abogado es el que se antoja incluir, y es justo el caso que rompe la
   * promesa: ve sus expedientes restringidos pero no los de los demás, así que
   * su archivo saldría incompleto sin que nada lo dijera.
   */
  it('a nadie más, ni al abogado', () => {
    const otros: RolMembresia[] = ['abogado', 'pasante', 'asistente', 'cliente']
    for (const rol of otros) {
      expect(puedeExportar(rol), rol).toBe(false)
    }
  })
})

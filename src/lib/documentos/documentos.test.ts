import { describe, expect, it } from 'vitest'

import {
  AVISO_VISIBILIDAD,
  NUNCA_VISIBLE,
  leerActuacion,
  validarActuacion,
} from '@/lib/bitacora/captura'

import {
  MIMES_ACEPTADOS,
  TOPE_BYTES,
  leerDocumento,
  nombreSeguro,
  rutaDeDocumento,
  siguienteVersion,
  tamanoLegible,
  validarArchivo,
} from './archivos'

const HOY = '2026-09-03'

describe('nombreSeguro', () => {
  it('quita acentos y baja a minúsculas', () => {
    expect(nombreSeguro('Demanda Inicial ÁÉÍ.pdf')).toBe('demanda-inicial-aei.pdf')
  })

  it('neutraliza el recorrido de directorios', () => {
    // Lo teclea quien sube. `../../otro-despacho/x.pdf` tiene que salir de aquí
    // convertido en algo inofensivo.
    const salida = nombreSeguro('../../otro-despacho/secreto.pdf')
    expect(salida).not.toContain('/')
    expect(salida).not.toContain('..')
  })

  it('no deja diagonales ni contrabarras', () => {
    expect(nombreSeguro('carpeta\\sub/archivo.pdf')).not.toMatch(/[\\/]/)
  })

  it('un nombre que se queda en nada tiene respaldo', () => {
    expect(nombreSeguro('...')).toBe('documento')
    expect(nombreSeguro('///')).toBe('documento')
    expect(nombreSeguro('')).toBe('documento')
  })

  it('recorta los nombres kilométricos', () => {
    expect(nombreSeguro('a'.repeat(300)).length).toBeLessThanOrEqual(80)
  })

  it('conserva la extensión de un nombre normal', () => {
    expect(nombreSeguro('acuse_sellado.pdf')).toContain('.pdf')
  })
})

describe('rutaDeDocumento', () => {
  const ruta = rutaDeDocumento({
    despachoId: 'desp-1',
    expedienteId: 'exp-9',
    identificador: 'abc123',
    nombre: 'Demanda.pdf',
  })

  it('pone el despacho primero y el expediente segundo', () => {
    // Las políticas de Storage leen el SEGUNDO segmento. Cambiar el orden aquí
    // sin cambiarlas allá abriría los archivos de todos los despachos.
    expect(ruta.split('/')[0]).toBe('desp-1')
    expect(ruta.split('/')[1]).toBe('exp-9')
  })

  it('cada subida tiene su propio archivo', () => {
    // Dos versiones nunca comparten ruta: si la compartieran, la segunda
    // borraría el escrito que sí se presentó.
    const otra = rutaDeDocumento({
      despachoId: 'desp-1',
      expedienteId: 'exp-9',
      identificador: 'xyz789',
      nombre: 'Demanda.pdf',
    })
    expect(otra).not.toBe(ruta)
  })

  it('sanea el nombre antes de meterlo a la ruta', () => {
    const sucia = rutaDeDocumento({
      despachoId: 'desp-1',
      expedienteId: 'exp-9',
      identificador: 'abc',
      nombre: '../fuera.pdf',
    })
    expect(sucia.split('/')).toHaveLength(3)
  })
})

describe('validarArchivo', () => {
  const bueno = { nombre: 'a.pdf', tamano: 1024, mime: 'application/pdf' }

  it('acepta un PDF normal', () => {
    expect(validarArchivo(bueno)).toEqual([])
  })

  it('rechaza el archivo vacío', () => {
    expect(validarArchivo({ ...bueno, tamano: 0 })).toHaveLength(1)
  })

  it('rechaza lo que pasa del tope', () => {
    // Sin tope, una subida basta para llenar el disco del servidor.
    const problemas = validarArchivo({ ...bueno, tamano: TOPE_BYTES + 1 })
    expect(problemas[0]?.mensaje).toMatch(/MB/)
  })

  it('acepta justo el tope', () => {
    expect(validarArchivo({ ...bueno, tamano: TOPE_BYTES })).toEqual([])
  })

  it('rechaza lo ejecutable', () => {
    for (const mime of ['application/x-msdownload', 'text/html', 'application/x-sh']) {
      expect(validarArchivo({ ...bueno, mime })).not.toEqual([])
    }
  })

  it('acepta los formatos de un despacho de verdad', () => {
    for (const mime of MIMES_ACEPTADOS) {
      expect(validarArchivo({ ...bueno, mime })).toEqual([])
    }
  })
})

describe('siguienteVersion', () => {
  it('el primero es la versión 1', () => {
    expect(siguienteVersion('Demanda', [])).toBe(1)
  })

  it('sube desde la más alta que haya', () => {
    expect(
      siguienteVersion('Demanda', [
        { nombre: 'Demanda', version: 1 },
        { nombre: 'Demanda', version: 2 },
      ]),
    ).toBe(3)
  })

  it('no se confunde con otro documento', () => {
    expect(
      siguienteVersion('Contestación', [{ nombre: 'Demanda', version: 4 }]),
    ).toBe(1)
  })

  it('agrupa sin importar mayúsculas ni espacios', () => {
    // "la demanda" es la demanda aunque se teclee distinto cada vez.
    expect(
      siguienteVersion('  demanda ', [{ nombre: 'Demanda', version: 2 }]),
    ).toBe(3)
  })

  it('aguanta huecos en la numeración', () => {
    expect(
      siguienteVersion('Demanda', [
        { nombre: 'Demanda', version: 1 },
        { nombre: 'Demanda', version: 7 },
      ]),
    ).toBe(8)
  })
})

describe('leerDocumento', () => {
  it('si no le ponen nombre, usa el del archivo', () => {
    expect(leerDocumento({}, 'acuse.pdf').nombre).toBe('acuse.pdf')
  })

  it('un tipo inventado cae en "otro"', () => {
    expect(leerDocumento({ tipo: 'inventado' }, 'a.pdf').tipo).toBe('otro')
  })

  it('lee el acuse al que corresponde', () => {
    expect(leerDocumento({ acuseDeId: 'doc-1' }, 'a.pdf').acuseDeId).toBe('doc-1')
  })
})

describe('tamanoLegible', () => {
  it('escribe megas con un decimal', () => {
    expect(tamanoLegible(2_500_000)).toBe('2.4 MB')
  })

  it('lo chico va en kilobytes', () => {
    expect(tamanoLegible(5_000)).toBe('5 KB')
  })

  it('sin dato no inventa uno', () => {
    expect(tamanoLegible(null)).toBe('')
    expect(tamanoLegible(0)).toBe('')
  })
})

describe('leerActuacion', () => {
  it('lee lo que manda el formulario', () => {
    const leido = leerActuacion({
      tipo: 'acuerdo',
      fecha: '2026-09-01',
      titulo: '  Acuerdo que admite la demanda ',
      detalle: 'Se admitió en la vía ordinaria.',
    })
    expect(leido.tipo).toBe('acuerdo')
    expect(leido.fecha).toBe('2026-09-01')
    expect(leido.titulo).toBe('Acuerdo que admite la demanda')
  })

  it('un tipo inventado cae en nota interna, que es lo más cerrado', () => {
    expect(leerActuacion({ tipo: 'lo-que-sea' }).tipo).toBe('nota_interna')
  })

  it('una nota interna NUNCA sale visible, aunque venga marcada', () => {
    // Es la única categoría cuyo nombre promete que el cliente no la ve.
    // Ocultar la casilla no detiene a quien llame la acción directo.
    const leido = leerActuacion({ tipo: 'nota_interna', visibleCliente: 'on' })
    expect(leido.visibleCliente).toBe(false)
    expect(NUNCA_VISIBLE).toContain('nota_interna')
  })

  it('los demás tipos sí se pueden marcar visibles', () => {
    expect(
      leerActuacion({ tipo: 'acuerdo', visibleCliente: 'on' }).visibleCliente,
    ).toBe(true)
  })

  it('descarta una fecha que no es fecha', () => {
    expect(leerActuacion({ fecha: '01/09/2026' }).fecha).toBeNull()
  })
})

describe('validarActuacion', () => {
  const buena = leerActuacion({
    tipo: 'acuerdo',
    fecha: '2026-09-01',
    titulo: 'Acuerdo que admite la demanda',
  })

  it('acepta una actuación normal', () => {
    expect(validarActuacion(buena, HOY)).toEqual([])
  })

  it('exige un título que diga algo', () => {
    expect(validarActuacion({ ...buena, titulo: 'x' }, HOY)).not.toEqual([])
  })

  it('exige la fecha', () => {
    expect(validarActuacion({ ...buena, fecha: null }, HOY)).not.toEqual([])
  })

  it('rechaza una fecha futura', () => {
    // La bitácora registra lo que ya pasó; un plan va en la agenda.
    const problemas = validarActuacion({ ...buena, fecha: '2026-12-01' }, HOY)
    expect(problemas[0]?.campo).toBe('fecha')
  })

  it('acepta hoy y acepta el pasado', () => {
    // Se captura el lunes lo que pasó el viernes, y eso es lo normal.
    expect(validarActuacion({ ...buena, fecha: HOY }, HOY)).toEqual([])
    expect(validarActuacion({ ...buena, fecha: '2025-01-15' }, HOY)).toEqual([])
  })
})

describe('el aviso de visibilidad', () => {
  it('dice que no se puede deshacer', () => {
    // La fila no se puede editar, y aunque se pudiera, el cliente ya la vio.
    expect(AVISO_VISIBILIDAD).toMatch(/no se puede deshacer/i)
  })
})

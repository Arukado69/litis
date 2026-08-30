/**
 * Lectura y validación de la captura del alta de expediente (pura, sin efectos).
 *
 * Es la frontera entre lo que teclea una persona y el dominio. Todo lo que
 * entra aquí es texto sin garantías: campos vacíos, números con comas, ids
 * inventados. Sale una estructura tipada o una lista de problemas.
 *
 * Se prueba aparte del resto porque es el punto por el que entra la basura, y
 * porque las reglas de "qué falta" son las que el usuario ve en pantalla.
 */

import type { Fuero, IdMateria } from './materias'
import { MATERIAS, buscarVia } from './materias'
import { ROLES_POR_MATERIA, type RolParte, type TipoPersona } from './partes'

export interface Problema {
  campo: string
  mensaje: string
}

export interface ParteCapturada {
  nombre: string
  tipo: TipoPersona
  rfc: string | null
  rol: string
  abogadoContrario: string | null
}

export interface CapturaAlta {
  materia: IdMateria
  via: string
  fuero: Fuero
  entidad: string | null
  numeroOrgano: string | null
  organoId: string | null
  instancia: string | null
  cuantia: number | null
  fechaInicio: string | null
  responsableId: string | null
  restringido: boolean
  caratula: string | null
  notas: string | null
  /** A quién representamos. */
  nuestraParte: ParteCapturada
  /** La de enfrente. Opcional: un asunto puede abrirse antes de saber quién es. */
  contraparte: ParteCapturada | null
}

/** Lee un campo de texto, ya recortado. Vacío se vuelve `null`. */
function texto(campos: Record<string, string>, clave: string): string | null {
  const valor = campos[clave]?.trim()
  return valor && valor.length > 0 ? valor : null
}

/**
 * Cuantía: acepta lo que la gente teclea de verdad —`$1,250,000.00`— y
 * devuelve `null` si no queda un número utilizable.
 *
 * Se devuelve `null` en vez de `0`: una cuantía de cero es un dato, y "no la
 * capturé" es otro. Confundirlos haría que un asunto sin cuantía apareciera
 * como un asunto de cero pesos.
 */
export function leerCuantia(valor: string | undefined): number | null {
  if (!valor) return null
  const limpio = valor.replace(/[$\s,]/g, '')
  if (limpio.length === 0) return null
  const numero = Number(limpio)
  if (!Number.isFinite(numero) || numero < 0) return null
  return numero
}

/** `yyyy-mm-dd` o `null`. Un formato distinto se descarta en vez de adivinarse. */
export function leerFecha(valor: string | undefined): string | null {
  if (!valor) return null
  const limpio = valor.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(limpio) ? limpio : null
}

function leerTipoPersona(valor: string | undefined): TipoPersona {
  return valor === 'moral' ? 'moral' : 'fisica'
}

/** Convierte los campos crudos del formulario en la captura tipada. */
export function leerCaptura(campos: Record<string, string>): CapturaAlta {
  const nombreContraparte = texto(campos, 'contraparteNombre')

  return {
    materia: (campos.materia ?? '') as IdMateria,
    via: campos.via ?? '',
    fuero: campos.fuero === 'federal' ? 'federal' : 'comun',
    entidad: texto(campos, 'entidad'),
    numeroOrgano: texto(campos, 'numeroOrgano'),
    organoId: texto(campos, 'organoId'),
    instancia: texto(campos, 'instancia'),
    cuantia: leerCuantia(campos.cuantia),
    fechaInicio: leerFecha(campos.fechaInicio),
    responsableId: texto(campos, 'responsableId'),
    restringido: campos.restringido === 'on' || campos.restringido === 'true',
    caratula: texto(campos, 'caratula'),
    notas: texto(campos, 'notas'),
    nuestraParte: {
      nombre: campos.clienteNombre?.trim() ?? '',
      tipo: leerTipoPersona(campos.clienteTipo),
      rfc: texto(campos, 'clienteRfc'),
      rol: campos.clienteRol ?? '',
      abogadoContrario: null,
    },
    contraparte: nombreContraparte
      ? {
          nombre: nombreContraparte,
          tipo: leerTipoPersona(campos.contraparteTipo),
          rfc: texto(campos, 'contraparteRfc'),
          rol: campos.contraparteRol ?? '',
          abogadoContrario: texto(campos, 'contraparteAbogado'),
        }
      : null,
  }
}

/**
 * Qué impide guardar.
 *
 * Solo lo que dejaría al sistema calculando mal o mostrando un expediente
 * inservible. Lo que se puede completar después —el número del juzgado, el
 * órgano, el responsable— sale como advertencia en `prepararApertura`, no
 * como bloqueo.
 */
export function validarCaptura(captura: CapturaAlta): Problema[] {
  const problemas: Problema[] = []

  if (!MATERIAS[captura.materia]) {
    problemas.push({ campo: 'materia', mensaje: 'Elige la materia.' })
  }

  const via = buscarVia(captura.via)
  if (!via) {
    problemas.push({
      campo: 'via',
      mensaje: 'Elige la vía. Sin ella no se pueden computar plazos.',
    })
  }

  if (captura.nuestraParte.nombre.length < 2) {
    problemas.push({
      campo: 'clienteNombre',
      mensaje: 'Escribe a quién representas.',
    })
  }

  // El rol depende de la materia: "actor" no existe en amparo, donde es
  // "quejoso". Validarlo aquí evita guardar un rol que la interfaz no sabrá
  // mostrar después.
  const rolesValidos: readonly RolParte[] =
    ROLES_POR_MATERIA[captura.materia] ?? []

  if (!rolesValidos.includes(captura.nuestraParte.rol as RolParte)) {
    problemas.push({
      campo: 'clienteRol',
      mensaje: 'Elige con qué carácter interviene tu cliente.',
    })
  }

  if (captura.contraparte) {
    if (!rolesValidos.includes(captura.contraparte.rol as RolParte)) {
      problemas.push({
        campo: 'contraparteRol',
        mensaje: 'Elige el carácter de la contraparte.',
      })
    }
    if (captura.contraparte.rol === captura.nuestraParte.rol) {
      problemas.push({
        campo: 'contraparteRol',
        mensaje:
          'Las dos partes no pueden tener el mismo carácter: alguien demanda y alguien es demandado.',
      })
    }
  }

  return problemas
}

'use server'

import { randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'

import { exigirPanel } from '@/lib/auth/sesion'
import {
  leerActuacion,
  validarActuacion,
  NUNCA_VISIBLE,
} from '@/lib/bitacora/captura'
import { documentosDelExpediente } from '@/lib/bitacora/datos'
import {
  leerDocumento,
  rutaDeDocumento,
  siguienteVersion,
  validarArchivo,
} from '@/lib/documentos/archivos'
import { obtenerExpediente } from '@/lib/expedientes/datos'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import { clienteServidor } from '@/lib/supabase/server'

import type { EstadoActuacion, EstadoDocumento } from './estado-bitacora'

const BUCKET = 'documentos'

function comoCampos(formData: FormData): Record<string, string> {
  const campos: Record<string, string> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor === 'string') campos[clave] = valor
  }
  return campos
}

/**
 * Asienta una actuación en la bitácora.
 *
 * ⚠️ **Es irreversible.** `actuaciones` no tiene política de UPDATE ni DELETE:
 * lo que entra aquí se queda. Corregir es asentar otra actuación que rectifique,
 * igual que en un expediente de papel se agrega una foja en vez de tachar la
 * anterior. Eso incluye `visible_cliente`: si se marca visible, no hay forma de
 * quitarlo — y aunque la hubiera, el cliente ya lo vio.
 */
export async function asentarActuacion(
  _previo: EstadoActuacion,
  formData: FormData,
): Promise<EstadoActuacion> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const expedienteId = campos.expedienteId ?? ''

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) {
    return { valores: campos, error: 'No se encontró el expediente.', problemas: {}, guardado: null }
  }

  const captura = leerActuacion(campos)
  const problemasCaptura = validarActuacion(captura, hoyEnMexico())

  if (problemasCaptura.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasCaptura) problemas[p.campo] ??= p.mensaje
    return { valores: campos, error: null, problemas, guardado: null }
  }

  // `validarActuacion` ya exigió la fecha; el compilador no lo sabe.
  if (!captura.fecha) {
    return {
      valores: campos,
      error: null,
      problemas: { fecha: 'Captura la fecha en que ocurrió.' },
      guardado: null,
    }
  }

  const supabase = await clienteServidor()
  const { error } = await supabase.from('actuaciones').insert({
    expediente_id: expedienteId,
    tipo: captura.tipo,
    fecha: captura.fecha,
    titulo: captura.titulo,
    detalle: captura.detalle,
    // `leerActuacion` ya lo forzó a false en las notas internas; se repite el
    // candado aquí para que la regla no dependa de que la lectura no cambie.
    visible_cliente:
      captura.visibleCliente && !NUNCA_VISIBLE.includes(captura.tipo),
    creado_por: sesion.usuarioId,
  })

  if (error) {
    return {
      valores: campos,
      error: 'No se pudo asentar la actuación. Vuelve a intentarlo.',
      problemas: {},
      guardado: null,
    }
  }

  revalidatePath(`/panel/expedientes/${expedienteId}`)
  return {
    valores: {},
    error: null,
    problemas: {},
    guardado: 'Quedó asentada en la bitácora.',
  }
}

/**
 * Sube un documento al bucket privado y lo registra.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIMERO EL ARCHIVO, DESPUÉS LA FILA
 * ─────────────────────────────────────────────────────────────────────────────
 * Si la fila se escribiera antes y la subida fallara, la lista mostraría un
 * documento que al oprimirlo no existe — y nadie sabría si se perdió o nunca
 * se subió. Al revés, lo que queda es un archivo huérfano en el bucket: ocupa
 * espacio y no lo ve nadie, que es un problema mucho más barato.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NO SE SOBRESCRIBE
 * ─────────────────────────────────────────────────────────────────────────────
 * Cada subida tiene su propia ruta con un uuid nuevo, y el mismo nombre suma
 * versión. El borrador y lo presentado son dos documentos distintos, y en un
 * juicio los dos importan por separado.
 */
export async function subirDocumento(
  _previo: EstadoDocumento,
  formData: FormData,
): Promise<EstadoDocumento> {
  const sesion = await exigirPanel()
  const campos = comoCampos(formData)
  const expedienteId = campos.expedienteId ?? ''

  const expediente = await obtenerExpediente(expedienteId)
  if (!expediente) {
    return { valores: campos, error: 'No se encontró el expediente.', problemas: {}, guardado: null }
  }

  const archivo = formData.get('archivo')
  if (!(archivo instanceof File) || archivo.size === 0) {
    return {
      valores: campos,
      error: null,
      problemas: { archivo: 'Elige un archivo.' },
      guardado: null,
    }
  }

  const problemasArchivo = validarArchivo({
    nombre: archivo.name,
    tamano: archivo.size,
    mime: archivo.type,
  })
  if (problemasArchivo.length > 0) {
    const problemas: Record<string, string> = {}
    for (const p of problemasArchivo) problemas[p.campo] ??= p.mensaje
    return { valores: campos, error: null, problemas, guardado: null }
  }

  const captura = leerDocumento(campos, archivo.name)
  const existentes = await documentosDelExpediente(expedienteId)
  const version = siguienteVersion(captura.nombre, existentes)

  const ruta = rutaDeDocumento({
    // El despacho sale de la SESIÓN, no del formulario: si viniera de un campo
    // oculto, cambiarlo metería el archivo en la carpeta de otro despacho.
    despachoId: sesion.activa.despachoId,
    expedienteId,
    identificador: randomUUID(),
    nombre: captura.nombre,
  })

  const supabase = await clienteServidor()

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, {
      contentType: archivo.type,
      // Nunca se pisa un archivo existente: cada subida es una versión nueva.
      upsert: false,
    })

  if (errorSubida) {
    return {
      valores: campos,
      error: `No se pudo guardar el archivo (${errorSubida.message}). No quedó registrado.`,
      problemas: {},
      guardado: null,
    }
  }

  const { error } = await supabase.from('documentos').insert({
    expediente_id: expedienteId,
    tipo: captura.tipo,
    nombre: captura.nombre,
    ruta_storage: ruta,
    tamano_bytes: archivo.size,
    mime: archivo.type,
    version,
    acuse_de_id: captura.acuseDeId,
    visible_cliente: captura.visibleCliente,
    notas: captura.notas,
    subido_por: sesion.usuarioId,
  })

  if (error) {
    // El archivo ya está arriba pero nadie lo va a encontrar. Se limpia para no
    // dejar basura que ocupe espacio sin servir a nada.
    await supabase.storage.from(BUCKET).remove([ruta])
    return {
      valores: campos,
      error: 'El archivo subió pero no se pudo registrar, así que se quitó. Vuelve a intentarlo.',
      problemas: {},
      guardado: null,
    }
  }

  revalidatePath(`/panel/expedientes/${expedienteId}`)
  return {
    valores: {},
    error: null,
    problemas: {},
    guardado:
      version === 1
        ? `Se guardó "${captura.nombre}".`
        : `Se guardó "${captura.nombre}" como versión ${version}. La anterior sigue ahí.`,
  }
}

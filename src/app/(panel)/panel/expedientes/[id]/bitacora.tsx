'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  Area,
  Aviso,
  Boton,
  Campo,
  Casilla,
  Selector,
  type Opcion,
} from '@/components/ui/primitivos'
import {
  AVISO_VISIBILIDAD,
  NUNCA_VISIBLE,
  TIPO_ACTUACION_AYUDA,
  TIPO_ACTUACION_ETIQUETA,
} from '@/lib/bitacora/captura'
import {
  TIPO_DOCUMENTO_ETIQUETA,
  TOPE_BYTES,
} from '@/lib/documentos/archivos'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import type { TipoActuacion, TipoDocumento } from '@/types/db'

import { asentarActuacion, subirDocumento } from './acciones-bitacora'
import {
  ESTADO_INICIAL_ACTUACION,
  ESTADO_INICIAL_DOCUMENTO,
} from './estado-bitacora'

const TIPOS_ACTUACION: Opcion[] = (
  Object.keys(TIPO_ACTUACION_ETIQUETA) as TipoActuacion[]
).map((t) => ({ valor: t, etiqueta: TIPO_ACTUACION_ETIQUETA[t] }))

const TIPOS_DOCUMENTO: Opcion[] = (
  Object.keys(TIPO_DOCUMENTO_ETIQUETA) as TipoDocumento[]
).map((t) => ({ valor: t, etiqueta: TIPO_DOCUMENTO_ETIQUETA[t] }))

function BotonEnviar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Guardando…' : children}
    </Boton>
  )
}

/**
 * Asentar una actuación a mano.
 *
 * Se abre bajo demanda: la bitácora se lee mucho más de lo que se escribe, y un
 * formulario permanentemente abierto empuja hacia abajo lo que sí se consulta.
 *
 * ⚠️ La casilla de visibilidad desaparece en las notas internas. No es adorno:
 * es la única categoría cuyo nombre le promete al despacho que el cliente no la
 * va a ver.
 */
export function AsentarActuacion({ expedienteId }: { expedienteId: string }) {
  const [abierto, setAbierto] = useState(false)
  const [tipo, setTipo] = useState<TipoActuacion>('acuerdo')
  const [estado, enviar] = useActionState(
    asentarActuacion,
    ESTADO_INICIAL_ACTUACION,
  )

  if (!abierto) {
    return (
      <div className="flex items-center gap-4">
        <Boton variante="secundario" type="button" onClick={() => setAbierto(true)}>
          Asentar actuación
        </Boton>
        {estado.guardado ? (
          <span className="text-menor text-[var(--color-holgado)]">
            {estado.guardado}
          </span>
        ) : null}
      </div>
    )
  }

  const puedeSerVisible = !NUNCA_VISIBLE.includes(tipo)

  return (
    <form
      action={enviar}
      className="flex flex-col gap-4 rounded-sm border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
    >
      <input type="hidden" name="expedienteId" value={expedienteId} />

      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Qué pasó"
          nombre="tipo"
          opciones={TIPOS_ACTUACION}
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoActuacion)}
          vacio={null}
          ayuda={TIPO_ACTUACION_AYUDA[tipo]}
        />
        <Campo
          etiqueta="Cuándo ocurrió"
          nombre="fecha"
          type="date"
          max={hoyEnMexico()}
          defaultValue={estado.valores.fecha ?? ''}
          error={estado.problemas.fecha}
          ayuda="La fecha del hecho, no la de captura."
        />
      </div>

      <Campo
        etiqueta="De qué se trata"
        nombre="titulo"
        defaultValue={estado.valores.titulo ?? ''}
        error={estado.problemas.titulo}
        placeholder="Acuerdo que admite la demanda en la vía ordinaria"
      />
      <Area
        etiqueta="Detalle"
        nombre="detalle"
        defaultValue={estado.valores.detalle ?? ''}
        rows={4}
      />

      {puedeSerVisible ? (
        <Casilla
          etiqueta="El cliente puede verla"
          nombre="visibleCliente"
          defaultChecked={estado.valores.visibleCliente === 'on'}
          ayuda={AVISO_VISIBILIDAD}
        />
      ) : (
        <p className="text-nota text-[var(--color-tinta-suave)]">
          Una nota interna nunca se comparte con el cliente. Si esto es para él,
          asiéntalo como comunicación.
        </p>
      )}

      <Aviso tono="informativo">
        La bitácora no se edita ni se borra. Si algo sale mal, se corrige
        asentando otra actuación que rectifique.
      </Aviso>

      <div className="flex items-center gap-3">
        <BotonEnviar>Asentar</BotonEnviar>
        <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)}>
          Cerrar sin guardar
        </Boton>
      </div>
    </form>
  )
}

const MEGAS = Math.round(TOPE_BYTES / (1024 * 1024))

export function SubirDocumento({
  expedienteId,
  documentos,
}: {
  expedienteId: string
  documentos: readonly { id: string; nombre: string; version: number }[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, enviar] = useActionState(subirDocumento, ESTADO_INICIAL_DOCUMENTO)

  if (!abierto) {
    return (
      <div className="flex items-center gap-4">
        <Boton variante="secundario" type="button" onClick={() => setAbierto(true)}>
          Subir documento
        </Boton>
        {estado.guardado ? (
          <span className="text-menor text-[var(--color-holgado)]">
            {estado.guardado}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <form
      action={enviar}
      className="flex flex-col gap-4 rounded-sm border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
    >
      <input type="hidden" name="expedienteId" value={expedienteId} />

      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Campo
        etiqueta="Archivo"
        nombre="archivo"
        type="file"
        required
        error={estado.problemas.archivo}
        ayuda={`PDF, imagen o Word, hasta ${MEGAS} MB.`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Selector
          etiqueta="Qué es"
          nombre="tipo"
          opciones={TIPOS_DOCUMENTO}
          defaultValue={estado.valores.tipo ?? 'promocion'}
          vacio={null}
        />
        <Campo
          etiqueta="Cómo se llama"
          nombre="nombre"
          defaultValue={estado.valores.nombre ?? ''}
          placeholder="Demanda inicial"
          ayuda="Con el mismo nombre, la subida cuenta como una versión nueva."
        />
      </div>

      {documentos.length > 0 ? (
        <Selector
          etiqueta="¿Es el acuse de algo?"
          nombre="acuseDeId"
          opciones={documentos.map((d) => ({
            valor: d.id,
            etiqueta: `${d.nombre} (v${d.version})`,
          }))}
          defaultValue={estado.valores.acuseDeId ?? ''}
          vacio="No es un acuse"
          ayuda="El acuse sellado que devuelve el juzgado, ligado al escrito que ampara."
        />
      ) : null}

      <Area
        etiqueta="Notas"
        nombre="notas"
        defaultValue={estado.valores.notas ?? ''}
        rows={2}
      />

      <Casilla
        etiqueta="El cliente puede verlo"
        nombre="visibleCliente"
        defaultChecked={estado.valores.visibleCliente === 'on'}
      />

      <div className="flex items-center gap-3">
        <BotonEnviar>Subir</BotonEnviar>
        <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)}>
          Cerrar sin guardar
        </Boton>
      </div>
    </form>
  )
}

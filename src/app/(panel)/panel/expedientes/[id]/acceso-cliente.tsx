'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Aviso, Boton, Campo } from '@/components/ui/primitivos'

import { darAccesoAlCliente } from './acciones-portal'
import { ESTADO_INICIAL_ACCESO } from './estado-portal'

function BotonDar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Dar acceso'}
    </Boton>
  )
}

/**
 * Abrirle el portal al cliente del expediente.
 *
 * El correo lo teclea el despacho, y la persona del padrón la fija el
 * expediente: quien reciba el enlace no puede elegir a qué cliente se vincula.
 */
export function AccesoDelCliente({
  expedienteId,
  clienteNombre,
}: {
  expedienteId: string
  clienteNombre: string | null
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, enviar] = useActionState(darAccesoAlCliente, ESTADO_INICIAL_ACCESO)

  if (!abierto && !estado.enlace) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Boton variante="secundario" type="button" onClick={() => setAbierto(true)}>
          Dar acceso al cliente
        </Boton>
        {estado.error ? (
          <span className="text-menor text-[var(--color-urgente)]">
            {estado.error}
          </span>
        ) : null}
      </div>
    )
  }

  if (estado.enlace) {
    return (
      <div className="flex flex-col gap-2 border-l-2 border-[var(--color-sello)] bg-[var(--color-sello-tenue)] py-3 pl-4 pr-3">
        {estado.aviso ? (
          <p className="text-menor font-medium">{estado.aviso}</p>
        ) : null}
        <p className="text-nota text-[var(--color-tinta-suave)]">
          Este enlace se muestra una sola vez: en la base solo queda su huella.
        </p>
        <code className="overflow-x-auto rounded-sm border border-[var(--color-regla)] bg-[var(--color-foja)] p-2 text-nota">
          {estado.enlace}
        </code>
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
        etiqueta={`Correo de ${clienteNombre ?? 'tu cliente'}`}
        nombre="correo"
        type="email"
        defaultValue={estado.valores.correo ?? ''}
        error={estado.problemas.correo}
        ayuda="El enlace solo funciona con este correo, aunque lo reenvíen."
      />

      <Aviso tono="informativo">
        Va a poder ver en qué etapa está el asunto, sus audiencias, y solo las
        actuaciones y documentos que marques como visibles. Nunca los plazos ni
        las notas internas.
      </Aviso>

      <div className="flex items-center gap-3">
        <BotonDar />
        <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)}>
          Cerrar
        </Boton>
      </div>
    </form>
  )
}

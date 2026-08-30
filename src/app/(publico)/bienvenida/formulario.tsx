'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Aviso, Boton, Campo } from '@/components/ui/primitivos'

import { crearDespacho } from './acciones'
import { ESTADO_INICIAL } from './estado'

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending} className="w-full">
      {pending ? 'Creando…' : 'Crear despacho'}
    </Boton>
  )
}

export function FormularioBienvenida({
  nombreSugerido,
  despachoSugerido,
}: {
  nombreSugerido: string
  despachoSugerido: string
}) {
  const [estado, accion] = useActionState(crearDespacho, ESTADO_INICIAL)

  return (
    <form action={accion} className="flex flex-col gap-4">
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Campo
        etiqueta="Tu nombre"
        nombre="nombre"
        autoComplete="name"
        required
        defaultValue={nombreSugerido}
      />
      <Campo
        etiqueta="Nombre del despacho"
        nombre="nombreDespacho"
        autoComplete="organization"
        required
        defaultValue={despachoSugerido}
        autoFocus={despachoSugerido.length === 0}
      />

      <BotonEnviar />
    </form>
  )
}

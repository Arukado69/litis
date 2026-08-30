'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Aviso, Boton, Campo } from '@/components/ui/primitivos'

import { iniciarSesion } from './acciones'
import { ESTADO_INICIAL } from './estado'

function BotonEnviar() {
  // `useFormStatus` tiene que leerse desde un hijo del <form>, no desde el
  // mismo componente que lo renderiza: ahí siempre devolvería `pending: false`.
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending} className="w-full">
      {pending ? 'Entrando…' : 'Entrar'}
    </Boton>
  )
}

export function FormularioAcceso({ destino }: { destino: string }) {
  const [estado, accion] = useActionState(iniciarSesion, ESTADO_INICIAL)

  return (
    <form action={accion} className="flex flex-col gap-4">
      <input type="hidden" name="destino" value={destino} />

      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Campo
        etiqueta="Correo"
        nombre="correo"
        type="email"
        autoComplete="email"
        required
        autoFocus
      />
      <Campo
        etiqueta="Contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="current-password"
        required
      />

      <BotonEnviar />
    </form>
  )
}

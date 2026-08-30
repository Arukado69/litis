'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Aviso, Boton, Campo } from '@/components/ui/primitivos'

import { registrarse } from './acciones'
import { ESTADO_INICIAL } from './estado'

function BotonEnviar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending} className="w-full">
      {pending ? 'Creando…' : 'Crear despacho'}
    </Boton>
  )
}

export function FormularioRegistro() {
  const [estado, accion] = useActionState(registrarse, ESTADO_INICIAL)

  if (estado.confirmaCorreo) {
    return (
      <Aviso tono="exito">
        Te mandamos un correo para confirmar la cuenta. Ábrelo y entra: en ese
        momento terminamos de crear tu despacho.
      </Aviso>
    )
  }

  return (
    <form action={accion} className="flex flex-col gap-4">
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Campo
        etiqueta="Tu nombre"
        nombre="nombre"
        autoComplete="name"
        required
        autoFocus
        error={estado.problemas.nombre}
      />
      <Campo
        etiqueta="Nombre del despacho"
        nombre="nombreDespacho"
        autoComplete="organization"
        required
        error={estado.problemas.nombreDespacho}
        ayuda="Puedes cambiarlo después."
      />
      <Campo
        etiqueta="Correo"
        nombre="correo"
        type="email"
        autoComplete="email"
        required
        error={estado.problemas.correo}
      />
      <Campo
        etiqueta="Contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="new-password"
        required
        error={estado.problemas.contrasena}
        ayuda="Al menos 10 caracteres. Una frase larga sirve más que símbolos raros."
      />

      <BotonEnviar />
    </form>
  )
}

'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { Aviso, Boton, Campo } from '@/components/ui/primitivos'

import { aceptarInvitacion } from './acciones'
import { ESTADO_INICIAL_ACEPTAR } from './estado'

function BotonEntrar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending} className="w-full">
      {pending ? 'Entrando…' : 'Aceptar y entrar'}
    </Boton>
  )
}

/**
 * El formulario de aceptación.
 *
 * El correo se muestra pero **no se puede editar**: lo fija la invitación. Un
 * campo editable ahí convertiría un enlace reenviado en un pase de entrada
 * para cualquiera.
 */
export function FormularioAceptar({
  token,
  correo,
}: {
  token: string
  correo: string
}) {
  const [estado, enviar] = useActionState(
    aceptarInvitacion,
    ESTADO_INICIAL_ACEPTAR,
  )

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Campo
        etiqueta="Tu correo"
        nombre="correoVisible"
        type="email"
        value={correo}
        readOnly
        disabled
        ayuda="Lo fija la invitación: no se puede cambiar."
      />
      <Campo
        etiqueta="Tu nombre"
        nombre="nombre"
        autoComplete="name"
        required
        autoFocus
        defaultValue={estado.valores.nombre ?? ''}
      />
      <Campo
        etiqueta="Contraseña"
        nombre="contrasena"
        type="password"
        autoComplete="current-password"
        required
        ayuda="Si ya tienes cuenta con este correo, escribe la tuya. Si no, esta será tu nueva contraseña."
      />

      <BotonEntrar />
    </form>
  )
}

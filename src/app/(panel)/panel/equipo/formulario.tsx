'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  Aviso,
  Boton,
  Campo,
  Selector,
  type Opcion,
} from '@/components/ui/primitivos'
import {
  ROLES_INVITABLES,
  ROL_ALCANCE,
  ROL_MEMBRESIA_ETIQUETA,
} from '@/lib/despachos/invitaciones'

import { invitarAlEquipo } from './acciones'
import { ESTADO_INICIAL_INVITAR } from './estado'

const ROLES: Opcion[] = ROLES_INVITABLES.map((r) => ({
  valor: r,
  etiqueta: `${ROL_MEMBRESIA_ETIQUETA[r]} — ${ROL_ALCANCE[r]}`,
}))

function BotonInvitar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Creando…' : 'Invitar'}
    </Boton>
  )
}

/**
 * El alta de una invitación.
 *
 * Cuando se crea, la pantalla enseña el **enlace en claro**. Es la única vez
 * que existe —a la base solo va su hash— y se muestra a propósito: un despacho
 * de tres personas se coordina por WhatsApp, no esperando un correo. Si el
 * proveedor de correo no está configurado, además es la única vía.
 */
export function FormularioInvitar() {
  const [estado, enviar] = useActionState(invitarAlEquipo, ESTADO_INICIAL_INVITAR)

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Correo"
          nombre="correo"
          type="email"
          defaultValue={estado.valores.correo ?? ''}
          error={estado.problemas.correo}
          placeholder="danny@despacho.mx"
          ayuda="El enlace solo funciona con este correo, aunque lo reenvíen."
        />
        <Selector
          etiqueta="Con qué papel entra"
          nombre="rol"
          opciones={ROLES}
          defaultValue={estado.valores.rol ?? 'abogado'}
          error={estado.problemas.rol}
          vacio={null}
        />
      </div>

      <div>
        <BotonInvitar />
      </div>

      {estado.aviso ? <Aviso tono="informativo">{estado.aviso}</Aviso> : null}

      {estado.enlace ? (
        <div className="flex flex-col gap-2 border-l-2 border-[var(--color-sello)] bg-[var(--color-sello-tenue)] py-3 pl-4 pr-3">
          <p className="text-menor font-medium">
            Este enlace se muestra una sola vez
          </p>
          <p className="text-nota text-[var(--color-tinta-suave)]">
            En la base solo queda su huella, así que aquí no se puede volver a
            consultar. Si se pierde, revoca la invitación y manda otra.
          </p>
          <code className="overflow-x-auto rounded-sm border border-[var(--color-regla)] bg-[var(--color-foja)] p-2 text-nota">
            {estado.enlace}
          </code>
        </div>
      ) : null}
    </form>
  )
}

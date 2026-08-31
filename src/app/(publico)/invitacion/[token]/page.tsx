import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Foja } from '@/components/ui/primitivos'
import {
  hashDeToken,
  ROL_ALCANCE,
  ROL_MEMBRESIA_ETIQUETA,
} from '@/lib/despachos/invitaciones'
import { clienteServidor } from '@/lib/supabase/server'

import { FormularioAceptar } from './formulario'

export const metadata: Metadata = {
  title: 'Invitación',
  // El token viaja en la URL. Que un buscador la guarde sería repartir la
  // llave del despacho.
  robots: { index: false, follow: false },
}

/**
 * La pantalla a la que lleva el enlace.
 *
 * Antes de pedirle nada a quien llegó hay que decirle a qué despacho lo
 * invitan y con qué papel; si no, es un formulario sin contexto que nadie
 * completa. Esos datos salen de `mirar_invitacion`, que devuelve **lo mínimo**
 * —nombre del despacho, correo, papel y vigencia— porque quien llega todavía no
 * pertenece a nada y no puede leer la tabla.
 *
 * ⚠️ El token viaja en la URL, así que esta ruta **no se indexa ni se cachea**.
 */
export const dynamic = 'force-dynamic'

export default async function PaginaInvitacion({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await clienteServidor()

  const { data } = await supabase.rpc('mirar_invitacion', {
    p_token_hash: hashDeToken(token),
  })
  const invitacion = data?.[0]

  if (!invitacion || !invitacion.vigente) {
    return (
      <Foja className="flex flex-col gap-4">
        <h1 className="text-rotulo">Esta invitación ya no sirve</h1>
        <Aviso tono="error">
          Puede haber caducado —duran siete días—, haberse usado ya, o el
          titular pudo revocarla. Pídele que te mande una nueva.
        </Aviso>
        <p className="text-menor text-[var(--color-tinta-suave)]">
          ¿Ya tienes cuenta?{' '}
          <Link href="/acceso" className="font-medium underline">
            Entrar
          </Link>
        </p>
      </Foja>
    )
  }

  return (
    <Foja className="flex flex-col gap-5">
      <div>
        <h1 className="text-rotulo">{invitacion.despacho_nombre}</h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          Te invitaron a entrar como{' '}
          {ROL_MEMBRESIA_ETIQUETA[invitacion.rol].toLowerCase()}.{' '}
          {ROL_ALCANCE[invitacion.rol]}
        </p>
      </div>

      <FormularioAceptar token={token} correo={invitacion.correo} />

      <p className="text-nota text-[var(--color-tinta-suave)]">
        Al entrar vas a ver los expedientes del despacho, sus plazos y sus
        audiencias. Si no esperabas esta invitación, cierra esta página.
      </p>
    </Foja>
  )
}

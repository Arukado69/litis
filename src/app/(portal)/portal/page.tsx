import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Foja, Sello } from '@/components/ui/primitivos'
import { exigirPortal } from '@/lib/auth/sesion'
import { asuntosDelCliente } from '@/lib/portal/datos'
import { AVISO_PORTAL, faseEnLlano, ultimoMovimiento } from '@/lib/portal/lenguaje'
import { hoyEnMexico } from '@/lib/plazos/fecha'

export const metadata: Metadata = { title: 'Mis asuntos' }

export default async function PaginaPortal() {
  const sesion = await exigirPortal()
  const hoy = hoyEnMexico()
  const personaId = sesion.activa.personaId

  // Una membresía de cliente sin persona del padrón no puede ver nada. Se dice
  // en vez de enseñar una lista vacía que parece un error del sistema.
  if (!personaId) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-portada">Mis asuntos</h1>
        <Aviso tono="error">
          Tu cuenta todavía no está vinculada a tu expediente. Escríbele a tu
          abogado para que la vincule; es un paso que hacen ellos, no tú.
        </Aviso>
      </div>
    )
  }

  const asuntos = await asuntosDelCliente(sesion.activa.despachoId, personaId)

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <h1 className="text-portada">Mis asuntos</h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          {sesion.activa.despachoNombre}
        </p>
      </div>

      {asuntos.length === 0 ? (
        <Foja className="flex flex-col gap-2">
          <p className="font-medium">Todavía no hay asuntos a tu nombre aquí.</p>
          <p className="text-menor text-[var(--color-tinta-suave)]">
            Si esperabas ver uno, escríbele a tu abogado.
          </p>
        </Foja>
      ) : (
        <ul className="flex flex-col gap-4">
          {asuntos.map((a) => {
            const llano = faseEnLlano(a.via, a.etapaClave)
            return (
              <li key={a.id}>
                <Link
                  href={`/portal/${a.id}`}
                  className="block border-l-2 border-[var(--color-sello)] bg-[var(--color-foja)] p-5 hover:border-[var(--color-tinta)]"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-guia font-medium">{a.caratula}</p>
                    {a.estado === 'suspendido' ? (
                      <Sello tono="neutro">suspendido</Sello>
                    ) : null}
                  </div>

                  <p className="mt-2 font-medium">{llano.titulo}</p>
                  <p className="mt-0.5 max-w-prose text-menor text-[var(--color-tinta-suave)]">
                    {llano.queSignifica}
                  </p>

                  <p className="mt-2 text-nota text-[var(--color-tinta-suave)]">
                    {ultimoMovimiento(a.ultimoMovimientoEl, hoy)}
                    {a.responsableNombre ? ` · Lleva tu asunto: ${a.responsableNombre}` : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <p className="max-w-prose border-t border-[var(--color-regla)] pt-4 text-nota text-[var(--color-tinta-suave)]">
        {AVISO_PORTAL}
      </p>
    </div>
  )
}

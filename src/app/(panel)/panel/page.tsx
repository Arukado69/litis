import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Tarjeta } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { fechaLargaConDia, hoyEnMexico } from '@/lib/plazos/fecha'

export const metadata: Metadata = { title: 'Qué vence' }

/**
 * El panel de arranque.
 *
 * Todavía no hay expedientes que consultar —eso llega con R2 y R3—, así que
 * por ahora enseña el estado vacío honesto y lo que sigue. El motor que ordena
 * plazos y audiencias por urgencia ya existe en `src/lib/panel/pendientes.ts`;
 * lo que falta son las consultas que lo alimenten.
 */
export default async function PaginaPanel() {
  const sesion = await exigirPanel()
  const hoy = hoyEnMexico()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Qué vence</h1>
        <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
          {fechaLargaConDia(hoy)}
        </p>
      </div>

      <Tarjeta className="flex flex-col gap-3">
        <h2 className="font-medium">
          Bienvenido, {sesion.nombre || sesion.correo}
        </h2>
        <p className="text-sm text-[var(--color-tinta-suave)]">
          Tu despacho <strong>{sesion.activa.despachoNombre}</strong> quedó
          creado y tú eres el titular. Todavía no hay expedientes, así que no
          hay nada por vencer.
        </p>
      </Tarjeta>

      <Aviso tono="informativo">
        Lo que sigue: <Link href="/panel/expedientes/nuevo" className="underline">
        abrir el primer expediente</Link> y registrar una notificación para que
        el sistema compute su plazo.
      </Aviso>
    </div>
  )
}

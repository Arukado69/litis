import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Boton, Tarjeta } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { listarExpedientes } from '@/lib/expedientes/datos'
import { buscarVia, MATERIAS, type IdMateria } from '@/lib/expedientes/materias'
import type { EstadoExpediente } from '@/types/db'

export const metadata: Metadata = { title: 'Expedientes' }

const ESTADO_ETIQUETA: Record<EstadoExpediente, string> = {
  prospecto: 'Prospecto',
  activo: 'Activo',
  suspendido: 'Suspendido',
  concluido: 'Concluido',
  archivado: 'Archivado',
}

export default async function PaginaExpedientes() {
  const sesion = await exigirPanel()
  const expedientes = await listarExpedientes(sesion.activa.despachoId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expedientes</h1>
          <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
            {expedientes.length === 0
              ? 'Todavía no hay ninguno.'
              : `${expedientes.length} en el despacho.`}
          </p>
        </div>
        <Link href="/panel/expedientes/nuevo">
          <Boton>Abrir expediente</Boton>
        </Link>
      </div>

      {expedientes.length === 0 ? (
        <Aviso tono="informativo">
          Abre el primero. Al hacerlo se revisa el conflicto de interés contra
          tu padrón y se clonan las etapas de la vía que elijas.
        </Aviso>
      ) : (
        <Tarjeta className="p-0">
          {/* La tabla se desborda a scroll propio: en un teléfono, una carátula
              larga no debe empujar la página entera de lado. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-borde)] text-left text-xs uppercase tracking-wide text-[var(--color-tinta-suave)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Carátula</th>
                  <th className="px-4 py-3 font-medium">Materia y vía</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {expedientes.map((e) => (
                  <tr
                    key={e.id}
                    className="border-b border-[var(--color-borde)] last:border-0"
                  >
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      <Link
                        href={`/panel/expedientes/${e.id}`}
                        className="font-medium underline"
                      >
                        {e.numeroInterno}
                      </Link>
                      {e.numeroOrgano ? (
                        <div className="text-xs text-[var(--color-tinta-suave)]">
                          {e.numeroOrgano}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">{e.caratula}</td>
                    <td className="px-4 py-3 align-top text-[var(--color-tinta-suave)]">
                      {MATERIAS[e.materia as IdMateria]?.nombre ?? e.materia}
                      <div className="text-xs">
                        {buscarVia(e.via)?.nombre ?? e.via}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--color-tinta-suave)]">
                      {e.responsableNombre ?? (
                        <span className="text-[var(--color-urgente)]">
                          Sin responsable
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-[var(--color-tinta-suave)]">
                      {ESTADO_ETIQUETA[e.estado]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
      )}
    </div>
  )
}

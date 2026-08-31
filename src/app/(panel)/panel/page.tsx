import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Boton, Tarjeta } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { audienciasProgramadas, plazosPendientes } from '@/lib/panel/datos'
import {
  armarPanel,
  type Pendiente,
  type Urgencia,
} from '@/lib/panel/pendientes'
import {
  cargarCalendarioPorClave,
  cargarCalendariosPorId,
} from '@/lib/plazos/carga'
import { fechaLargaConDia, hoyEnMexico } from '@/lib/plazos/fecha'

export const metadata: Metadata = { title: 'Qué vence' }

const ESTILO_URGENCIA: Record<Urgencia, string> = {
  vencido: 'border-l-4 border-l-[var(--color-urgente)]',
  hoy: 'border-l-4 border-l-[var(--color-urgente)]',
  inminente: 'border-l-4 border-l-[var(--color-proximo)]',
  proximo: 'border-l-4 border-l-[var(--color-borde)]',
}

/** "faltan 3 días hábiles", "vence hoy", "venció hace 2 días hábiles". */
function cuantoFalta(dias: number): string {
  if (dias === 0) return 'Vence hoy'
  if (dias < 0) {
    const n = Math.abs(dias)
    return `Venció hace ${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`
  }
  return `Faltan ${dias} ${dias === 1 ? 'día hábil' : 'días hábiles'}`
}

function Fila({ p }: { p: Pendiente }) {
  return (
    <li
      className={`rounded-md border border-[var(--color-borde)] bg-white p-3 ${ESTILO_URGENCIA[p.urgencia]}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-xs uppercase tracking-wide text-[var(--color-tinta-suave)]">
            {p.tipo === 'audiencia' ? 'Audiencia' : 'Plazo'}
          </span>
          <p className="font-medium">{p.titulo}</p>
          <Link
            href={`/panel/expedientes/${p.expedienteId}`}
            className="text-sm text-[var(--color-tinta-suave)] underline"
          >
            {p.numeroInterno} · {p.caratula}
          </Link>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{cuantoFalta(p.diasHabiles)}</p>
          <p className="text-xs text-[var(--color-tinta-suave)]">
            {fechaLargaConDia(p.fecha)}
            {p.hora ? ` · ${p.hora}` : ''}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-[var(--color-tinta-suave)]">
        {p.responsableNombre ?? (
          <span className="text-[var(--color-urgente)]">Sin responsable</span>
        )}
        {p.lugar ? ` · ${p.lugar}` : ''}
        {p.confiabilidad === 'semilla_no_verificada'
          ? ' · cómputo sin verificar'
          : ''}
      </p>
    </li>
  )
}

function Grupo({
  titulo,
  pendientes,
}: {
  titulo: string
  pendientes: readonly Pendiente[]
}) {
  if (pendientes.length === 0) return null
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-[var(--color-tinta-suave)]">
        {titulo} ({pendientes.length})
      </h2>
      <ul className="flex flex-col gap-2">
        {pendientes.map((p) => (
          <Fila key={`${p.tipo}-${p.id}`} p={p} />
        ))}
      </ul>
    </section>
  )
}

export default async function PaginaPanel() {
  const sesion = await exigirPanel()
  const hoy = hoyEnMexico()
  const despachoId = sesion.activa.despachoId

  const [plazos, audiencias] = await Promise.all([
    plazosPendientes(despachoId),
    audienciasProgramadas(despachoId),
  ])

  // Cada plazo se computó con su propio calendario; se cargan todos los que
  // aparecen para que "faltan N días" sea cierto en cada renglón.
  const [calendarios, porOmision] = await Promise.all([
    cargarCalendariosPorId(
      plazos.map((p) => p.calendarioId).filter((id): id is string => id !== null),
    ),
    cargarCalendarioPorClave('pjf-2026'),
  ])

  if (!porOmision) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Qué vence</h1>
        <Aviso tono="error">
          No hay calendarios de días inhábiles cargados, así que no se pueden
          contar días hábiles. Aplica la migración de semilla.
        </Aviso>
      </div>
    )
  }

  const panel = armarPanel({
    plazos,
    audiencias,
    hoy,
    calendarios,
    calendarioPorOmision: porOmision,
  })

  const vacio = panel.pendientes.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Qué vence</h1>
          <p className="mt-1 text-sm text-[var(--color-tinta-suave)]">
            {fechaLargaConDia(hoy)}
          </p>
        </div>
        <Link href="/panel/expedientes/nuevo">
          <Boton variante="secundario">Abrir expediente</Boton>
        </Link>
      </div>

      {/* Los choques van arriba de todo: lo que arruina una semana no es un
          plazo apretado, es descubrir tarde que dos compromisos caen el mismo
          día en la misma persona. */}
      {panel.choques.length > 0 ? (
        <Tarjeta className="border-[var(--color-urgente)]/40">
          <h2 className="font-medium text-[var(--color-urgente)]">
            Choques de agenda
          </h2>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            {panel.choques.map((c) => (
              <li key={`${c.responsableId}-${c.fecha}`}>
                <p className="font-medium">
                  {c.responsableNombre} · {fechaLargaConDia(c.fecha)}
                  {c.conAudiencia ? ' · con audiencia' : ''}
                </p>
                <ul className="mt-1 text-[var(--color-tinta-suave)]">
                  {c.compromisos.map((x) => (
                    <li key={`${x.tipo}-${x.id}`}>
                      · {x.titulo} ({x.numeroInterno})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Tarjeta>
      ) : null}

      {panel.sinResponsable.length > 0 ? (
        <Aviso tono="error">
          {panel.sinResponsable.length} pendiente(s) sin responsable asignado.
          Nadie los está viendo, así que nadie los va a reclamar.
        </Aviso>
      ) : null}

      {vacio ? (
        <Tarjeta className="flex flex-col gap-2">
          <p className="font-medium">Nada por vencer en las próximas dos semanas.</p>
          <p className="text-sm text-[var(--color-tinta-suave)]">
            Los plazos aparecen aquí en cuanto registras una notificación en
            algún expediente.
          </p>
        </Tarjeta>
      ) : (
        <div className="flex flex-col gap-6">
          <Grupo titulo="Vencidos" pendientes={panel.vencidos} />
          <Grupo titulo="Hoy" pendientes={panel.hoy} />
          <Grupo titulo="Inminentes" pendientes={panel.inminentes} />
          <Grupo titulo="Próximos" pendientes={panel.proximos} />
        </div>
      )}
    </div>
  )
}

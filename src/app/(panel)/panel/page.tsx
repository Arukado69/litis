import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Boton, CintaDias, Foja, Sello } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { audienciasProgramadas, plazosPendientes } from '@/lib/panel/datos'
import { armarPanel, type Pendiente } from '@/lib/panel/pendientes'
import {
  cargarCalendarioPorClave,
  cargarCalendariosPorId,
} from '@/lib/plazos/carga'
import { fechaLargaConDia, hoyEnMexico } from '@/lib/plazos/fecha'

export const metadata: Metadata = { title: 'Qué vence' }

/** "faltan 3 días hábiles", "vence hoy", "venció hace 2 días hábiles". */
function cuantoFalta(dias: number): string {
  if (dias === 0) return 'Vence hoy'
  if (dias < 0) {
    const n = Math.abs(dias)
    return `Venció hace ${n} ${n === 1 ? 'día hábil' : 'días hábiles'}`
  }
  return `Faltan ${dias} ${dias === 1 ? 'día hábil' : 'días hábiles'}`
}

/** Lo que dice la cinta, para quien no la ve. */
function leyendaDeCinta(p: Pendiente): string {
  const habiles = p.cinta.filter((d) => d.habil).length
  return `${p.cinta.length} días naturales de aquí al vencimiento, ${habiles} de ellos hábiles.`
}

function Renglon({ p }: { p: Pendiente }) {
  const apremia = p.urgencia === 'vencido' || p.urgencia === 'hoy'

  return (
    <li
      className="margen bg-[var(--color-foja)] py-3 pl-4 pr-3"
      data-urgencia={p.urgencia}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">
          {p.titulo}
          {p.tipo === 'audiencia' ? (
            <span className="ml-2 align-middle">
              <Sello tono="neutro">audiencia</Sello>
            </span>
          ) : null}
        </p>
        <p
          className={
            apremia ? 'font-medium text-[var(--color-urgente)]' : 'font-medium'
          }
        >
          {cuantoFalta(p.diasHabiles)}
        </p>
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Link
          href={`/panel/expedientes/${p.expedienteId}`}
          className="text-menor text-[var(--color-tinta-suave)] underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)]"
        >
          {p.numeroInterno} · {p.caratula}
        </Link>
        <p className="text-menor text-[var(--color-tinta-suave)]">
          {fechaLargaConDia(p.fecha)}
          {p.hora ? `, ${p.hora}` : ''}
        </p>
      </div>

      {/* La cinta: cada celda un día natural, sólida si es hábil. Es lo que
          hace que "faltan nueve días" deje de sonar holgado. */}
      {p.cinta.length > 0 ? (
        <div className="mt-2">
          <CintaDias dias={p.cinta} descripcion={leyendaDeCinta(p)} />
        </div>
      ) : null}

      <p className="mt-2 text-nota text-[var(--color-tinta-suave)]">
        {p.responsableNombre ?? (
          <span className="font-medium text-[var(--color-urgente)]">
            Sin responsable
          </span>
        )}
        {p.lugar ? `, ${p.lugar}` : ''}
        {p.confiabilidad === 'semilla_no_verificada'
          ? ' — cómputo sin verificar'
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
      <h2 className="mb-2 text-guia">
        {titulo}{' '}
        <span className="font-obra text-menor font-normal text-[var(--color-tinta-suave)]">
          {pendientes.length}
        </span>
      </h2>
      {/* El fondo de la lista es la regla y los renglones son las fojas encima:
          así la separación es una línea de un pixel y no otra tarjeta. */}
      <ul className="flex flex-col gap-px border-y border-[var(--color-regla)] bg-[var(--color-regla)]">
        {pendientes.map((p) => (
          <Renglon key={`${p.tipo}-${p.id}`} p={p} />
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
        <h1 className="text-rotulo">Qué vence</h1>
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
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--color-regla-fuerte)] pb-4">
        <div>
          <p className="text-menor text-[var(--color-tinta-suave)]">
            {fechaLargaConDia(hoy)}
          </p>
          <h1 className="mt-0.5 text-portada">Qué vence</h1>
        </div>
        <Link href="/panel/expedientes/nuevo">
          <Boton variante="secundario">Abrir expediente</Boton>
        </Link>
      </div>

      {/* Los choques van arriba de todo: lo que arruina una semana no es un
          plazo apretado, es descubrir tarde que dos compromisos caen el mismo
          día en la misma persona. */}
      {panel.choques.length > 0 ? (
        <Foja className="border-[var(--color-urgente)]/40">
          <h2 className="text-guia text-[var(--color-urgente)]">
            Dos cosas el mismo día
          </h2>
          <ul className="mt-3 flex flex-col gap-3 text-menor">
            {panel.choques.map((c) => (
              <li key={`${c.responsableId}-${c.fecha}`}>
                <p className="font-medium">
                  {c.responsableNombre}, {fechaLargaConDia(c.fecha)}
                  {c.conAudiencia ? ', con audiencia de por medio' : ''}
                </p>
                <ul className="mt-1 text-[var(--color-tinta-suave)]">
                  {c.compromisos.map((x) => (
                    <li key={`${x.tipo}-${x.id}`}>
                      {x.titulo} ({x.numeroInterno})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </Foja>
      ) : null}

      {panel.sinResponsable.length > 0 ? (
        <Aviso tono="error">
          {panel.sinResponsable.length} pendiente
          {panel.sinResponsable.length === 1 ? '' : 's'} sin responsable
          asignado. Nadie los está viendo, así que nadie los va a reclamar.
        </Aviso>
      ) : null}

      {vacio ? (
        <Foja className="flex flex-col gap-2">
          <p className="font-medium">
            Nada por vencer en las próximas dos semanas.
          </p>
          <p className="text-menor text-[var(--color-tinta-suave)]">
            Los plazos aparecen aquí en cuanto registras una notificación en
            algún expediente.
          </p>
        </Foja>
      ) : (
        <div className="flex flex-col gap-7">
          <Grupo titulo="Vencidos" pendientes={panel.vencidos} />
          <Grupo titulo="Hoy" pendientes={panel.hoy} />
          <Grupo titulo="Esta semana" pendientes={panel.inminentes} />
          <Grupo titulo="Después" pendientes={panel.proximos} />
        </div>
      )}
    </div>
  )
}

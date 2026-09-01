import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Boton, Foja, Sello } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { expedientesDelTablero, etapasParaMover } from '@/lib/tablero/datos'
import {
  DIAS_PARA_ESTANCADO,
  armarTablero,
  diasSinMoverse,
  estancados,
  type ExpedienteEnTablero,
} from '@/lib/tablero/fases'
import { fechaLarga, hoyEnMexico } from '@/lib/plazos/fecha'

import { moverEtapa } from './acciones'

export const metadata: Metadata = { title: 'Tablero' }

function Tarjeta({
  e,
  hoy,
  etapas,
}: {
  e: ExpedienteEnTablero
  hoy: string
  etapas: readonly { clave: string; nombre: string }[]
}) {
  const dormido = e.plazosVivos === 0 && diasSinMoverse(e, hoy) >= DIAS_PARA_ESTANCADO

  return (
    <li className="border-t border-[var(--color-regla)] bg-[var(--color-foja)] px-3 py-3 first:border-t-0">
      <Link
        href={`/panel/expedientes/${e.id}`}
        className="font-medium underline decoration-transparent underline-offset-4 hover:decoration-[var(--color-sello)]"
      >
        {e.caratula}
      </Link>

      <p className="mt-0.5 text-nota text-[var(--color-tinta-suave)]">
        {e.numeroOrgano ?? e.numeroInterno} · {e.viaNombre}
      </p>

      {/* La etapa REAL, siempre. La columna dice en qué fase va la cartera; esto
          dice qué toca en este asunto. */}
      {e.etapaNombre ? (
        <p className="mt-1 text-menor">{e.etapaNombre}</p>
      ) : null}

      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-nota text-[var(--color-tinta-suave)]">
        {e.responsableNombre ?? (
          <span className="font-medium text-[var(--color-urgente)]">
            Sin responsable
          </span>
        )}
        {e.proximoVencimiento ? (
          <span>· vence el {fechaLarga(e.proximoVencimiento)}</span>
        ) : null}
        {e.estado === 'suspendido' ? <Sello tono="neutro">suspendido</Sello> : null}
        {e.estado === 'prospecto' ? <Sello tono="neutro">prospecto</Sello> : null}
        {dormido ? (
          <Sello tono="urgente">{diasSinMoverse(e, hoy)} días sin moverse</Sello>
        ) : null}
      </p>

      {e.paralelas.length > 0 ? (
        <p className="mt-1 flex flex-wrap gap-1">
          {/* Las paralelas no son una columna: el asunto no está en ellas, las
              tiene mientras avanza por su propia etapa. */}
          {e.paralelas.map((p) => (
            <Sello key={p} tono="neutro">
              {p} en paralelo
            </Sello>
          ))}
        </p>
      ) : null}

      {etapas.length > 0 ? (
        <form action={moverEtapa} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="expedienteId" value={e.id} />
          <label htmlFor={`etapa-${e.id}`} className="sr-only">
            Mover {e.caratula} de etapa
          </label>
          <select
            id={`etapa-${e.id}`}
            name="etapaActual"
            defaultValue={e.etapaClave ?? ''}
            className="min-w-0 flex-1 rounded-sm border border-[var(--color-regla)] bg-[var(--color-foja)] px-2 py-1 text-nota"
          >
            <option value="">Sin etapa</option>
            {etapas.map((et) => (
              <option key={et.clave} value={et.clave}>
                {et.nombre}
              </option>
            ))}
          </select>
          <Boton variante="fantasma" type="submit" className="px-0 py-0">
            Mover
          </Boton>
        </form>
      ) : null}
    </li>
  )
}

export default async function PaginaTablero() {
  const sesion = await exigirPanel()
  const hoy = hoyEnMexico()

  const expedientes = await expedientesDelTablero(sesion.activa.despachoId)
  const etapasPorExpediente = await etapasParaMover(expedientes.map((e) => e.id))
  const tablero = armarTablero(expedientes)
  const dormidos = estancados(expedientes, hoy)

  const etapasDe = (id: string) => etapasPorExpediente.get(id) ?? []

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <h1 className="text-portada">Tablero</h1>
        <p className="mt-2 max-w-prose text-menor text-[var(--color-tinta-suave)]">
          {tablero.total} {tablero.total === 1 ? 'asunto vivo' : 'asuntos vivos'} en
          las seis fases por las que pasa cualquier proceso. Las columnas son
          universales para poder comparar la cartera completa; debajo de cada
          asunto va su etapa <strong>real</strong>, que es la que dice qué toca.
        </p>
      </div>

      {/* Lo dormido va arriba: es lo que se cae por caducidad sin que nadie se
          entere, justamente porque no tiene un plazo que lo delate. */}
      {dormidos.length > 0 ? (
        <Foja className="border-[var(--color-urgente)]/40">
          <h2 className="text-guia text-[var(--color-urgente)]">
            Sin moverse hace más de {DIAS_PARA_ESTANCADO} días
          </h2>
          <p className="mt-1 max-w-prose text-menor text-[var(--color-tinta-suave)]">
            Ninguno tiene un plazo corriendo, así que nada los va a delatar. Son
            los que se caen por caducidad.
          </p>
          <ul className="mt-3 flex flex-col gap-1 text-menor">
            {dormidos.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/panel/expedientes/${e.id}`}
                  className="underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)]"
                >
                  {e.caratula}
                </Link>{' '}
                <span className="text-[var(--color-tinta-suave)]">
                  — {diasSinMoverse(e, hoy)} días, {e.etapaNombre ?? 'sin etapa'}
                </span>
              </li>
            ))}
          </ul>
        </Foja>
      ) : null}

      {tablero.sinEtapa.length > 0 ? (
        <Foja>
          <h2 className="text-guia">Sin etapa capturada</h2>
          <p className="mt-1 max-w-prose text-menor text-[var(--color-tinta-suave)]">
            No están en ninguna columna porque no se sabe en qué van. Van aparte
            a propósito: repartirlos en “Preparación” los volvería invisibles.
          </p>
          <ul className="mt-3 border-t border-[var(--color-regla)]">
            {tablero.sinEtapa.map((e) => (
              <Tarjeta key={e.id} e={e} hoy={hoy} etapas={etapasDe(e.id)} />
            ))}
          </ul>
        </Foja>
      ) : null}

      {tablero.total === 0 ? (
        <Foja className="flex flex-col gap-2">
          <p className="font-medium">Todavía no hay asuntos vivos.</p>
          <p className="text-menor text-[var(--color-tinta-suave)]">
            El tablero se llena solo conforme abres expedientes.
          </p>
          <div className="mt-2">
            <Link href="/panel/expedientes/nuevo">
              <Boton>Abrir expediente</Boton>
            </Link>
          </div>
        </Foja>
      ) : (
        // Scroll propio: seis columnas no caben en una laptop, y la página
        // entera no debe moverse de lado.
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[64rem] grid-cols-6 gap-px bg-[var(--color-regla)]">
            {tablero.columnas.map((c) => (
              <section key={c.fase.id} className="bg-[var(--color-archivo)]">
                <div className="bg-[var(--color-tenue)] px-3 py-2">
                  <h2 className="text-menor font-medium">
                    {c.fase.nombre}{' '}
                    <span className="font-obra font-normal text-[var(--color-tinta-suave)]">
                      {c.expedientes.length}
                    </span>
                  </h2>
                  <p className="mt-0.5 text-nota text-[var(--color-tinta-suave)]">
                    {c.fase.descripcion}
                  </p>
                </div>

                {c.expedientes.length === 0 ? (
                  <p className="px-3 py-4 text-nota text-[var(--color-regla-fuerte)]">
                    Nada aquí
                  </p>
                ) : (
                  <ul>
                    {c.expedientes.map((e) => (
                      <Tarjeta key={e.id} e={e} hoy={hoy} etapas={etapasDe(e.id)} />
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </div>
      )}

      {tablero.sinFase.length > 0 ? (
        <Aviso tono="informativo">
          {tablero.sinFase.length}{' '}
          {tablero.sinFase.length === 1 ? 'asunto tiene' : 'asuntos tienen'} una
          etapa que el tablero no sabe dónde poner (
          {tablero.sinFase.map((e) => e.etapaNombre).join(', ')}). Suele pasar
          con etapas capturadas a mano. Se quedan fuera de las columnas en vez
          de caer en una equivocada.
        </Aviso>
      ) : null}

      <p className="max-w-prose border-t border-[var(--color-regla)] pt-4 text-nota text-[var(--color-tinta-suave)]">
        No se arrastran tarjetas a propósito: mover la etapa escribe en la
        bitácora, que no se edita ni se borra. Un arrastre accidental dejaría
        asentado para siempre que el asunto pasó a pruebas el día que no pasó.
      </p>
    </div>
  )
}

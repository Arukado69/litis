'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  Area,
  Aviso,
  Boton,
  Campo,
  Casilla,
  Selector,
  Foja,
  type Opcion,
} from '@/components/ui/primitivos'
import { AVISO_COMPUTO } from '@/lib/brand'
import { fechaLargaConDia } from '@/lib/plazos/fecha'
import { TIPO_NOTIFICACION_ETIQUETA } from '@/lib/plazos/regimenes'

import { registrarNotificacion } from './acciones'
import { ESTADO_INICIAL, type VistaPrevia } from './estado'

const TIPOS: Opcion[] = (
  ['personal', 'lista', 'oficio', 'electronica', 'edictos'] as const
).map((t) => ({ valor: t, etiqueta: TIPO_NOTIFICACION_ETIQUETA[t] }))

function BotonEnviar({ hayVista }: { hayVista: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending
        ? hayVista
          ? 'Guardando…'
          : 'Calculando…'
        : hayVista
          ? 'Confirmar y guardar'
          : 'Calcular el plazo'}
    </Boton>
  )
}

/**
 * El cómputo con su razonamiento completo.
 *
 * Esto es el producto. No se enseña una fecha: se enseña de dónde sale, qué
 * días se saltaron y con qué fundamento, para que un abogado pueda auditarlo
 * en treinta segundos antes de firmar.
 */
function Computo({ vista }: { vista: VistaPrevia }) {
  return (
    <Foja className="flex flex-col gap-5 border-[var(--color-sello)]/40">
      <div>
        <p className="text-menor text-[var(--color-tinta-suave)]">
          Cómputo sugerido de {vista.etiqueta}
        </p>
        <p className="mt-1 text-rotulo">
          Vence el {fechaLargaConDia(vista.fechaVencimiento)}
        </p>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          {vista.diasDelPlazo} {vista.unidad} · Calendario:{' '}
          {vista.calendarioNombre}
        </p>
      </div>

      {vista.confiabilidad === 'semilla_no_verificada' ? (
        <Aviso tono="error">
          Este cómputo se apoya en catálogo <strong>no verificado</strong> por
          el despacho. Confírmalo contra el texto vigente antes de agendar la
          presentación.
        </Aviso>
      ) : null}

      <div>
        <h3 className="mb-2 text-menor font-medium">Cómo se llegó a esa fecha</h3>
        <ol className="flex flex-col gap-2">
          {vista.pasos.map((p) => (
            <li
              key={p.orden}
              className="rounded-md border border-[var(--color-regla)] bg-[var(--color-tenue)] p-3 text-menor"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {p.orden}. {p.titulo}
                </span>
                {p.fecha ? (
                  <span className="text-nota text-[var(--color-tinta-suave)]">
                    {fechaLargaConDia(p.fecha)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[var(--color-tinta-suave)]">{p.detalle}</p>
              {p.fundamento ? (
                <p className="mt-1 text-nota italic text-[var(--color-tinta-suave)]">
                  {p.fundamento}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>

      {vista.diasOmitidos.length > 0 ? (
        <div>
          <h3 className="mb-2 text-menor font-medium">
            Días que no se contaron ({vista.diasOmitidos.length})
          </h3>
          <ul className="flex flex-wrap gap-1.5 text-nota">
            {vista.diasOmitidos.map((d) => (
              <li
                key={d.fecha}
                className="rounded border border-[var(--color-regla)] px-2 py-1 text-[var(--color-tinta-suave)]"
                title={d.descripcion}
              >
                {d.fecha} · {d.descripcion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {vista.advertencias.length > 0 ? (
        <div>
          <h3 className="mb-2 text-menor font-medium">Advertencias</h3>
          <ul className="flex flex-col gap-1.5 text-menor text-[var(--color-tinta-suave)]">
            {vista.advertencias.map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {vista.fundamentos.length > 0 ? (
        <div>
          <h3 className="mb-2 text-menor font-medium">Fundamento</h3>
          <ul className="flex flex-col gap-1 text-nota text-[var(--color-tinta-suave)]">
            {vista.fundamentos.map((f) => (
              <li key={f}>· {f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="border-t border-[var(--color-regla)] pt-3 text-nota text-[var(--color-tinta-suave)]">
        {AVISO_COMPUTO}
      </p>
    </Foja>
  )
}

export function FormularioNotificacion({
  expedienteId,
  plazos,
  miembros,
}: {
  expedienteId: string
  plazos: readonly (Opcion & { verificado: boolean })[]
  miembros: readonly Opcion[]
}) {
  const [estado, accion] = useActionState(
    registrarNotificacion,
    ESTADO_INICIAL,
  )
  const [aMano, setAMano] = useState(false)

  const v = (clave: string) => estado.valores[clave] ?? ''
  const vista = estado.vista

  return (
    <form action={accion} className="flex flex-col gap-6">
      <input type="hidden" name="expedienteId" value={expedienteId} />

      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Foja className="flex flex-col gap-4">
        <h2 className="font-medium">La notificación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Cómo se notificó"
            nombre="tipoNotificacion"
            required
            vacio={null}
            defaultValue={v('tipoNotificacion') || 'personal'}
            opciones={TIPOS}
            ayuda="Determina cuándo surte efectos, y con eso la fecha de vencimiento."
          />
          <Campo
            etiqueta="Fecha en que se practicó"
            nombre="fechaNotificacion"
            type="date"
            required
            defaultValue={v('fechaNotificacion')}
            error={estado.problemas.fechaNotificacion}
            ayuda="La del acuse, no la del acuerdo."
          />
        </div>
        <Area
          etiqueta="Qué dice el acuerdo"
          nombre="detalle"
          defaultValue={v('detalle')}
        />
      </Foja>

      <Foja className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-medium">El plazo</h2>
          <label className="flex items-center gap-2 text-menor">
            <input
              type="checkbox"
              checked={aMano}
              onChange={(e) => setAMano(e.target.checked)}
              className="accent-[var(--color-tinta)]"
            />
            Capturarlo a mano
          </label>
        </div>

        {aMano ? (
          <>
            <Aviso tono="informativo">
              Un plazo capturado a mano no tiene fundamento registrado ni
              verificación. Anota el artículo aplicable en el detalle.
            </Aviso>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo
                etiqueta="Nombre del plazo"
                nombre="etiquetaManual"
                defaultValue={v('etiquetaManual')}
                error={estado.problemas.etiquetaManual}
              />
              <Campo
                etiqueta="Días"
                nombre="diasManual"
                inputMode="numeric"
                defaultValue={v('diasManual')}
                error={estado.problemas.diasManual}
              />
              <Selector
                etiqueta="Unidad"
                nombre="unidadManual"
                vacio={null}
                defaultValue={v('unidadManual') || 'habiles'}
                opciones={[
                  { valor: 'habiles', etiqueta: 'Días hábiles' },
                  { valor: 'naturales', etiqueta: 'Días naturales' },
                ]}
              />
            </div>
          </>
        ) : (
          <Selector
            etiqueta="Plazo del catálogo"
            nombre="plazoCatalogoClave"
            required
            defaultValue={v('plazoCatalogoClave')}
            opciones={plazos}
            ayuda={
              plazos.length === 0
                ? 'No hay plazos cargados para el régimen de este expediente. Captúralo a mano.'
                : 'Solo se ofrecen los del régimen que corresponde a la vía.'
            }
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Término de la distancia"
            nombre="diasDistancia"
            inputMode="numeric"
            defaultValue={v('diasDistancia') || '0'}
            error={estado.problemas.diasDistancia}
            ayuda="Días adicionales. Cero si no aplica."
          />
          <Selector
            etiqueta="Responsable del plazo"
            nombre="responsableId"
            defaultValue={v('responsableId')}
            opciones={miembros}
            ayuda="A quién se le avisa cuando se acerque."
          />
        </div>
      </Foja>

      {vista ? <Computo vista={vista} /> : null}

      {vista ? (
        <Foja className="flex flex-col gap-4">
          <div>
            <h2 className="font-medium">Confirmar</h2>
            <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
              Si el motor no conoce algo —un acuerdo que habilitó días, una
              suspensión— corrige la fecha aquí. El cambio queda registrado con
              tu nombre.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              etiqueta="Fecha de vencimiento"
              nombre="fechaAjustada"
              type="date"
              defaultValue={v('fechaAjustada') || vista.fechaVencimiento}
              error={estado.problemas.fechaAjustada}
            />
            <Campo
              etiqueta="Motivo del ajuste"
              nombre="motivoAjuste"
              defaultValue={v('motivoAjuste')}
              error={estado.problemas.motivoAjuste}
              ayuda="Obligatorio solo si cambias la fecha."
            />
          </div>
          <Casilla
            etiqueta="Revisé el cómputo y lo doy por bueno"
            nombre="confirmado"
            required
          />
        </Foja>
      ) : null}

      <div className="flex justify-end">
        <BotonEnviar hayVista={vista !== null} />
      </div>
    </form>
  )
}

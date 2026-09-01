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
  type Opcion,
} from '@/components/ui/primitivos'
import { TIPOS_SUGERIDOS } from '@/lib/audiencias/audiencias'

import {
  celebrarAudiencia,
  diferirAudiencia,
  señalarAudiencia,
} from './acciones-audiencia'
import { ESTADO_INICIAL_AUDIENCIA } from './estado-audiencia'

function BotonEnviar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Guardando…' : children}
    </Boton>
  )
}

/**
 * Señalar una audiencia.
 *
 * Se captura con lo que dice el acuerdo. Lo que falte —hora, lugar, quién va—
 * se advierte DESPUÉS de guardar, no antes: un formulario que exige todo
 * obliga a anotar la audiencia en un papel mientras tanto.
 */
export function SenalarAudiencia({
  expedienteId,
  miembros,
}: {
  expedienteId: string
  miembros: readonly Opcion[]
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, enviar] = useActionState(
    señalarAudiencia,
    ESTADO_INICIAL_AUDIENCIA,
  )

  if (!abierto) {
    return (
      <div className="flex flex-wrap items-center gap-4">
        <Boton variante="secundario" type="button" onClick={() => setAbierto(true)}>
          Señalar audiencia
        </Boton>
        {estado.guardado ? (
          <span className="text-menor text-[var(--color-holgado)]">
            {estado.guardado}
          </span>
        ) : null}
        {estado.advertencias.length > 0 ? (
          <ul className="w-full text-nota text-[var(--color-proximo)]">
            {estado.advertencias.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  return (
    <form
      action={enviar}
      className="flex flex-col gap-4 rounded-sm border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
    >
      <input type="hidden" name="expedienteId" value={expedienteId} />
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Qué audiencia es"
          nombre="tipo"
          list="tipos-audiencia"
          defaultValue={estado.valores.tipo ?? ''}
          error={estado.problemas.tipo}
          placeholder="Audiencia preliminar"
          ayuda="Escribe el nombre que use tu juzgado; la lista es solo sugerencia."
        />
        {/* Lista abierta: entre 32 entidades y todas las materias hay nombres
            que no caben en un catálogo cerrado. */}
        <datalist id="tipos-audiencia">
          {TIPOS_SUGERIDOS.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <Campo
          etiqueta="Fecha señalada"
          nombre="fecha"
          type="date"
          defaultValue={estado.valores.fecha ?? ''}
          error={estado.problemas.fecha}
        />
        <Campo
          etiqueta="Hora"
          nombre="hora"
          type="time"
          defaultValue={estado.valores.hora ?? ''}
        />
        <Campo
          etiqueta="Lugar"
          nombre="lugar"
          defaultValue={estado.valores.lugar ?? ''}
          placeholder="Juzgado 5º Civil, sala 2"
        />
        <Selector
          etiqueta="Quién va"
          nombre="responsableId"
          opciones={miembros}
          defaultValue={estado.valores.responsableId ?? ''}
          vacio="Sin decidir"
          ayuda="Una audiencia sin responsable es una a la que no va nadie."
        />
      </div>

      <Area etiqueta="Notas" nombre="notas" defaultValue={estado.valores.notas ?? ''} rows={2} />

      <Casilla
        etiqueta="El cliente puede verla"
        nombre="visibleCliente"
        defaultChecked
        ayuda="Cuándo es su audiencia es de lo poco del expediente que le toca a él."
      />

      <div className="flex items-center gap-3">
        <BotonEnviar>Señalar</BotonEnviar>
        <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)}>
          Cerrar sin guardar
        </Boton>
      </div>
    </form>
  )
}

/**
 * Cerrar una audiencia programada: se celebró, o se difirió.
 *
 * ⚠️ Diferir NO cambia la fecha de la que estaba señalada: la marca diferida y
 * crea una nueva. Ese día se fue al juzgado y se esperó, y eso no se borra.
 */
export function CerrarAudiencia({
  audienciaId,
  fecha,
}: {
  audienciaId: string
  fecha: string
}) {
  const [modo, setModo] = useState<'ninguno' | 'celebrada' | 'diferida'>('ninguno')
  const [celebrada, enviarCelebrada] = useActionState(
    celebrarAudiencia,
    ESTADO_INICIAL_AUDIENCIA,
  )
  const [diferida, enviarDiferida] = useActionState(
    diferirAudiencia,
    ESTADO_INICIAL_AUDIENCIA,
  )

  const guardado = celebrada.guardado ?? diferida.guardado
  if (guardado) {
    return <p className="mt-2 text-nota text-[var(--color-holgado)]">{guardado}</p>
  }

  if (modo === 'ninguno') {
    return (
      <div className="mt-2 flex gap-3">
        <Boton variante="secundario" type="button" onClick={() => setModo('celebrada')}>
          Se celebró
        </Boton>
        <Boton variante="secundario" type="button" onClick={() => setModo('diferida')}>
          Se difirió
        </Boton>
      </div>
    )
  }

  if (modo === 'celebrada') {
    return (
      <form
        action={enviarCelebrada}
        className="mt-3 flex flex-col gap-3 rounded-sm border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
      >
        <input type="hidden" name="audienciaId" value={audienciaId} />
        {celebrada.error ? <Aviso tono="error">{celebrada.error}</Aviso> : null}
        <Area
          etiqueta="Qué pasó"
          nombre="resultado"
          rows={3}
          error={celebrada.problemas.resultado}
          placeholder="Se desahogaron dos testimoniales y se citó para alegatos."
          ayuda="Va a la bitácora, fechado el día de la audiencia."
        />
        <div className="flex items-center gap-3">
          <BotonEnviar>Asentar</BotonEnviar>
          <Boton variante="fantasma" type="button" onClick={() => setModo('ninguno')}>
            Cancelar
          </Boton>
        </div>
      </form>
    )
  }

  return (
    <form
      action={enviarDiferida}
      className="mt-3 flex flex-col gap-3 rounded-sm border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
    >
      <input type="hidden" name="audienciaId" value={audienciaId} />
      {diferida.error ? <Aviso tono="error">{diferida.error}</Aviso> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Nueva fecha"
          nombre="fechaNueva"
          type="date"
          min={fecha}
          error={diferida.problemas.fechaNueva}
        />
        <Campo etiqueta="Nueva hora" nombre="hora" type="time" ayuda="Si la dejas vacía se conserva la de antes." />
      </div>

      <Area
        etiqueta="Por qué se difirió"
        nombre="motivo"
        rows={2}
        error={diferida.problemas.motivo}
        placeholder="No se logró notificar al testigo."
        ayuda="Es lo que se le explica al cliente."
      />

      <Aviso tono="informativo">
        La fecha anterior no se borra: queda asentada como diferida, porque ese
        día se fue al juzgado y se esperó.
      </Aviso>

      <div className="flex items-center gap-3">
        <BotonEnviar>Diferir</BotonEnviar>
        <Boton variante="fantasma" type="button" onClick={() => setModo('ninguno')}>
          Cancelar
        </Boton>
      </div>
    </form>
  )
}

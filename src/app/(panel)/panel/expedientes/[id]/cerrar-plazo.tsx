'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Area, Aviso, Boton, Campo, Casilla } from '@/components/ui/primitivos'
import type { AccionCierre } from '@/lib/plazos/cierre'
import { hoyEnMexico } from '@/lib/plazos/fecha'

import { cerrarPlazo } from './acciones'
import { ESTADO_INICIAL_CIERRE } from './estado-plazo'

function BotonGuardar({ accion }: { accion: AccionCierre }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending
        ? 'Guardando…'
        : accion === 'presentada'
          ? 'Registrar la presentación'
          : 'Cancelar el plazo'}
    </Boton>
  )
}

/**
 * El formulario para sacar un plazo de la vigilancia.
 *
 * Se abre por plazo, no en una pantalla aparte: cerrar un término es lo que se
 * hace al volver del juzgado con el acuse en la mano, y mandar a navegar a otra
 * ruta para eso es la clase de fricción por la que se termina anotando en un
 * cuaderno.
 *
 * ⚠️ La casilla de extemporaneidad **no se muestra de entrada**. Aparece solo
 * cuando el servidor, con la fecha de vencimiento de la base a la vista,
 * responde que la presentación fue tardía. Ofrecerla desde el principio la
 * convertiría en una casilla más que se marca sin leer.
 */
export function CerrarPlazo({
  plazoId,
  puedeCancelar,
}: {
  plazoId: string
  puedeCancelar: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [accion, setAccion] = useState<AccionCierre>('presentada')
  const [estado, enviar] = useActionState(cerrarPlazo, ESTADO_INICIAL_CIERRE)

  if (!abierto) {
    return (
      <div className="mt-3">
        <Boton
          variante="secundario"
          type="button"
          onClick={() => setAbierto(true)}
        >
          Cerrar plazo
        </Boton>
      </div>
    )
  }

  return (
    <form
      action={enviar}
      className="mt-3 flex flex-col gap-4 rounded-md border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
    >
      <input type="hidden" name="plazoId" value={plazoId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="text-menor font-medium">¿Qué pasó con este plazo?</legend>
        <label className="flex items-center gap-2 text-menor">
          <input
            type="radio"
            name="accion"
            value="presentada"
            checked={accion === 'presentada'}
            onChange={() => setAccion('presentada')}
            className="accent-[var(--color-tinta)]"
          />
          Se presentó la promoción
        </label>
        {puedeCancelar ? (
          <label className="flex items-center gap-2 text-menor">
            <input
              type="radio"
              name="accion"
              value="cancelada"
              checked={accion === 'cancelada'}
              onChange={() => setAccion('cancelada')}
              className="accent-[var(--color-tinta)]"
            />
            Ya no aplica (desistimiento, acumulación, quedó sin materia)
          </label>
        ) : null}
      </fieldset>

      {accion === 'presentada' ? (
        <>
          <Campo
            etiqueta="Fecha de presentación"
            nombre="fechaPresentacion"
            type="date"
            max={hoyEnMexico()}
            defaultValue={estado.valores.fechaPresentacion ?? ''}
            error={estado.problemas.fechaPresentacion}
            ayuda="La del acuse, no la de captura."
          />
          <Area
            etiqueta="Qué se presentó"
            nombre="descripcion"
            defaultValue={estado.valores.descripcion ?? ''}
            placeholder="Escrito de contestación con tres anexos, acuse sellado."
          />
        </>
      ) : (
        <Area
          etiqueta="Por qué dejó de aplicar"
          nombre="motivo"
          defaultValue={estado.valores.motivo ?? ''}
          placeholder="El actor se desistió y el juzgado lo tuvo por desistido en el acuerdo del 12."
        />
      )}

      {estado.problemas.motivo ? (
        <p className="text-nota text-[var(--color-urgente)]">
          {estado.problemas.motivo}
        </p>
      ) : null}

      {estado.aviso ? (
        <div className="flex flex-col gap-3">
          <Aviso tono="error">{estado.aviso}</Aviso>
          <Casilla
            etiqueta="Sí, se presentó fuera de plazo"
            nombre="reconoceExtemporanea"
            defaultChecked={estado.valores.reconoceExtemporanea === 'on'}
          />
          {estado.problemas.reconoceExtemporanea ? (
            <p className="text-nota text-[var(--color-urgente)]">
              {estado.problemas.reconoceExtemporanea}
            </p>
          ) : null}
        </div>
      ) : null}

      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="flex items-center gap-3">
        <BotonGuardar accion={accion} />
        <Boton
          variante="fantasma"
          type="button"
          onClick={() => setAbierto(false)}
        >
          Cerrar sin guardar
        </Boton>
      </div>
    </form>
  )
}

'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Aviso, Boton, Campo } from '@/components/ui/primitivos'
import { MONEDA } from '@/lib/marketing/planes'
import { ASIENTOS_MAXIMOS } from '@/lib/suscripcion/limites'

import { contratar } from './acciones'
import { ESTADO_INICIAL_CONTRATAR } from './estado'

function BotonContratar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Abriendo el cobro…' : 'Contratar'}
    </Boton>
  )
}

/**
 * Cuántos asientos se contratan, con el total a la vista mientras se teclea.
 *
 * El total se calcula en el navegador solo para que se vea; **el importe que se
 * cobra lo pone Stripe** a partir del precio configurado, no este número. Un
 * precio que viaje desde el navegador es un precio que el navegador puede
 * cambiar.
 */
export function FormularioContratar({
  sugeridos,
  precioPorAsiento,
}: {
  sugeridos: number
  precioPorAsiento: number
}) {
  const [estado, enviar] = useActionState(contratar, ESTADO_INICIAL_CONTRATAR)
  const [asientos, setAsientos] = useState(String(sugeridos))

  const cantidad = Number.parseInt(asientos, 10)
  const total =
    Number.isFinite(cantidad) && cantidad > 0 ? cantidad * precioPorAsiento : null

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-32">
          <Campo
            etiqueta="Asientos"
            nombre="asientos"
            type="number"
            min={1}
            max={ASIENTOS_MAXIMOS}
            step={1}
            inputMode="numeric"
            value={asientos}
            onChange={(e) => setAsientos(e.target.value)}
            error={estado.problemas.asientos}
          />
        </div>

        <p className="pb-2 text-menor text-[var(--color-tinta-suave)]">
          {total === null ? (
            'Pon cuántas personas van a usar Litis.'
          ) : (
            <>
              <span className="font-medium text-[var(--color-tinta)]">
                ${total.toLocaleString('es-MX')} {MONEDA}
              </span>{' '}
              al mes · ${precioPorAsiento.toLocaleString('es-MX')} por asiento
            </>
          )}
        </p>

        <div className="pb-1">
          <BotonContratar />
        </div>
      </div>

      <p className="text-nota text-[var(--color-tinta-suave)]">
        El pago se hace en Stripe, no aquí: los datos de la tarjeta no pasan por
        este servidor. Los clientes que entran al portal no ocupan asiento.
      </p>

      {estado.aviso ? <Aviso tono="informativo">{estado.aviso}</Aviso> : null}
    </form>
  )
}

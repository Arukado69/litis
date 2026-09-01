'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Area, Aviso, Boton, Campo, Selector } from '@/components/ui/primitivos'
import type { EntradaResuelta } from '@/lib/catalogo/verificacion'

import { verificarEntrada } from './acciones'
import { ESTADO_INICIAL_VERIFICACION } from './estado'

function BotonFirmar() {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Guardando…' : 'Firmar la verificación'}
    </Boton>
  )
}

/**
 * El formulario de verificación de una entrada.
 *
 * Los días y el fundamento vienen precargados con lo que trae el catálogo: la
 * mayoría de las veces están bien y el trabajo es confirmarlos. Lo que NO viene
 * precargado es la nota: es lo único que no se puede rellenar por adelantado
 * sin volver la verificación un trámite de un clic.
 */
export function VerificarEntrada({
  resuelta,
  regimen,
}: {
  resuelta: EntradaResuelta
  regimen: string
}) {
  const [abierto, setAbierto] = useState(false)
  const [estado, enviar] = useActionState(
    verificarEntrada,
    ESTADO_INICIAL_VERIFICACION,
  )
  const { entrada } = resuelta
  const mio = estado.entradaId === entrada.id

  if (mio && estado.guardado && !abierto) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-nota text-[var(--color-holgado)]">{estado.guardado}</p>

        {/* El aviso que importa de esta pantalla: la corrección NO recalculó
            nada, y hay plazos vivos con la fecha vieja. */}
        {estado.aviso ? <Aviso tono="error">{estado.aviso}</Aviso> : null}
        {estado.afectados.length > 0 ? (
          <ul className="flex flex-col gap-1 text-menor">
            {estado.afectados.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/panel/expedientes/${p.expedienteId}`}
                  className="underline decoration-[var(--color-regla-fuerte)] underline-offset-4 hover:text-[var(--color-sello)]"
                >
                  {p.caratula} — {p.etiqueta}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  }

  if (!abierto) {
    return (
      <div className="mt-2">
        <Boton variante="secundario" type="button" onClick={() => setAbierto(true)}>
          {resuelta.estado === 'semilla' ? 'Revisar y verificar' : 'Volver a revisar'}
        </Boton>
      </div>
    )
  }

  const v = mio ? estado.valores : {}

  return (
    <form
      action={enviar}
      className="mt-3 flex flex-col gap-4 rounded-sm border border-[var(--color-regla)] bg-[var(--color-tenue)] p-4"
    >
      <input type="hidden" name="entradaId" value={entrada.id} />
      <input type="hidden" name="regimen" value={regimen} />

      {mio && estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="grid gap-4 sm:grid-cols-[8rem_12rem_1fr]">
        <Campo
          etiqueta="Días"
          nombre="dias"
          type="number"
          min={1}
          defaultValue={v.dias ?? String(entrada.dias)}
          error={mio ? estado.problemas.dias : undefined}
        />
        <Selector
          etiqueta="Se cuentan en"
          nombre="unidad"
          opciones={[
            { valor: 'habiles', etiqueta: 'Días hábiles' },
            { valor: 'naturales', etiqueta: 'Días naturales' },
          ]}
          defaultValue={v.unidad ?? entrada.unidad}
          vacio={null}
        />
        <Campo
          etiqueta="Fundamento"
          nombre="fundamento"
          defaultValue={v.fundamento ?? entrada.fundamento}
          error={mio ? estado.problemas.fundamento : undefined}
        />
      </div>

      <Area
        etiqueta="Contra qué texto lo revisaste"
        nombre="notas"
        rows={2}
        defaultValue={v.notas ?? ''}
        error={mio ? estado.problemas.notas : undefined}
        placeholder="Código de Comercio vigente al 1 de septiembre de 2026, consultado en el DOF."
        ayuda="Sin esto, dentro de seis meses nadie va a poder saber contra qué se revisó ni de qué fecha era ese texto."
      />

      <Aviso tono="informativo">
        Al firmar, esta entrada queda como del despacho con tu nombre y la fecha.
        La de fábrica sigue sin verificar para todos los demás: la firma vale
        para quien la pone.
      </Aviso>

      <div className="flex items-center gap-3">
        <BotonFirmar />
        <Boton variante="fantasma" type="button" onClick={() => setAbierto(false)}>
          Cerrar sin firmar
        </Boton>
      </div>
    </form>
  )
}

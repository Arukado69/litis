import type { Metadata } from 'next'

import { Aviso, Boton, Foja, Rotulo, Sello } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { MONEDA, PLANES } from '@/lib/marketing/planes'
import { fechaLarga } from '@/lib/plazos/fecha'
import { suscripcionYConsumo } from '@/lib/suscripcion/datos'
import {
  ACCIONES_LIBRES,
  ACCION_ETIQUETA,
  ESTADO_ETIQUETA,
  PLAN_ETIQUETA,
  asientosASugerir,
  asientosComprometidos,
  avisoDeExcedido,
  excedido,
  type Consumo,
  type Suscripcion,
} from '@/lib/suscripcion/limites'
import { hayStripe } from '@/lib/suscripcion/stripe'

import { abrirPortalDeCobro } from './acciones'
import { FormularioContratar } from './formulario'

export const metadata: Metadata = { title: 'Suscripción' }

const PLAN_DE_PAGA = PLANES.find((p) => p.clave === 'despacho')

/**
 * El medidor de uso.
 *
 * Es información, no adorno: la barra dice qué parte del plan está ocupada y el
 * renglón de abajo da los números exactos. Lleva su descripción para lector de
 * pantalla, porque un dato que solo existe como ancho de una barra no existe
 * para quien no la ve.
 */
function Medidor({
  etiqueta,
  usados,
  tope,
  detalle,
}: {
  etiqueta: string
  usados: number
  tope: number | null
  detalle: string
}) {
  const proporcion = tope === null ? 0 : Math.min(1, usados / Math.max(1, tope))
  const pasado = tope !== null && usados > tope
  const color = pasado ? 'var(--color-urgente)' : 'var(--color-tinta)'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-menor font-medium">{etiqueta}</p>
        <p className="text-menor tabular-nums">
          {usados}
          <span className="text-[var(--color-tinta-suave)]">
            {tope === null ? ' · sin tope' : ` de ${tope}`}
          </span>
        </p>
      </div>

      {tope === null ? null : (
        <div
          role="img"
          aria-label={`${etiqueta}: ${usados} de ${tope}.`}
          className="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-[var(--color-regla)]"
        >
          <div
            className="h-full"
            style={{ width: `${proporcion * 100}%`, background: color }}
          />
        </div>
      )}

      <p className="mt-1 text-nota text-[var(--color-tinta-suave)]">{detalle}</p>
    </div>
  )
}

function Vigencia({ suscripcion }: { suscripcion: Suscripcion }) {
  if (!suscripcion.periodoFin) return null
  const dia = fechaLarga(suscripcion.periodoFin.slice(0, 10))

  return (
    <p className="text-menor text-[var(--color-tinta-suave)]">
      {suscripcion.cancelaAlFin
        ? `Cancelada: llega hasta el ${dia} y después vuelve al plan gratuito. Nada se borra.`
        : suscripcion.estado === 'morosa'
          ? `El último cobro no pasó. El periodo en curso llega al ${dia} y mientras tanto no se bloquea nada: actualiza la tarjeta cuando puedas.`
          : `Periodo pagado hasta el ${dia}.`}
    </p>
  )
}

function detalleDeAsientos(consumo: Consumo): string {
  const base = `${consumo.asientosOcupados} ${consumo.asientosOcupados === 1 ? 'persona dentro' : 'personas dentro'}`
  if (consumo.invitacionesPendientes === 0) {
    return `${base}. Los clientes del portal no ocupan asiento.`
  }
  return `${base} y ${consumo.invitacionesPendientes} ${consumo.invitacionesPendientes === 1 ? 'invitación sin contestar, que ya aparta su asiento' : 'invitaciones sin contestar, que ya apartan su asiento'}.`
}

export default async function PaginaSuscripcion({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sesion = await exigirPanel()
  const esTitular = sesion.activa.rol === 'titular'
  const { suscripcion, consumo } = await suscripcionYConsumo(
    sesion.activa.despachoId,
  )

  const exceso = excedido(suscripcion, consumo)
  const cobro = (await searchParams).cobro
  const simulacion = !hayStripe()
  const precio = PLAN_DE_PAGA?.precio ?? 0

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <h1 className="text-portada">Suscripción</h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          {sesion.activa.despachoNombre}
        </p>
      </div>

      {cobro === 'listo' ? (
        <Aviso tono="exito">
          El pago quedó hecho. El plan se actualiza cuando Stripe nos avisa, casi
          siempre en segundos: si abajo todavía ves el plan anterior, recarga la
          página.
        </Aviso>
      ) : null}

      <Foja className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Rotulo>{PLAN_ETIQUETA[suscripcion.plan]}</Rotulo>
            <div className="mt-1">
              <Vigencia suscripcion={suscripcion} />
            </div>
          </div>
          <Sello
            tono={
              suscripcion.estado === 'morosa'
                ? 'urgente'
                : suscripcion.estado === 'activa'
                  ? 'sello'
                  : 'neutro'
            }
          >
            {ESTADO_ETIQUETA[suscripcion.estado]}
          </Sello>
        </div>

        <div className="grid gap-5 border-t border-[var(--color-regla)] pt-4 sm:grid-cols-2">
          <Medidor
            etiqueta="Expedientes activos"
            usados={consumo.expedientesActivos}
            tope={suscripcion.expedientesTope}
            detalle="Lo concluido y lo archivado no ocupa lugar."
          />
          <Medidor
            etiqueta="Asientos"
            usados={asientosComprometidos(consumo)}
            tope={suscripcion.asientos}
            detalle={detalleDeAsientos(consumo)}
          />
        </div>
      </Foja>

      {exceso ? <Aviso tono="error">{avisoDeExcedido(exceso)}</Aviso> : null}

      {esTitular ? (
        <Foja className="flex flex-col gap-4">
          <div>
            <Rotulo>
              {suscripcion.tieneCliente ? 'Tu cobro' : 'Pasar al plan de paga'}
            </Rotulo>
            <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
              {suscripcion.tieneCliente
                ? 'La tarjeta, los recibos, la cantidad de asientos y la cancelación se manejan en Stripe.'
                : `Expedientes sin tope y un asiento por cada persona del despacho, a $${precio.toLocaleString('es-MX')} ${MONEDA} por asiento al mes.`}
            </p>
          </div>

          {simulacion ? (
            <Aviso tono="informativo">
              No hay llaves de Stripe configuradas en este servidor. La pantalla
              funciona y se puede recorrer el flujo entero, pero{' '}
              <strong>no se cobra nada y el plan no cambia</strong>. Se hace así
              a propósito: si la simulación activara el plan, un despliegue con
              la llave mal escrita regalaría el producto sin que nadie se
              enterara.
            </Aviso>
          ) : null}

          {suscripcion.tieneCliente ? (
            <form action={abrirPortalDeCobro}>
              <Boton variante="secundario" type="submit">
                Administrar el cobro en Stripe
              </Boton>
            </form>
          ) : (
            <FormularioContratar
              sugeridos={asientosASugerir(consumo)}
              precioPorAsiento={precio}
            />
          )}
        </Foja>
      ) : (
        <Aviso tono="informativo">
          El plan lo contrata el titular del despacho. Aquí puedes ver en qué va
          el consumo.
        </Aviso>
      )}

      <section>
        <h2 className="mb-2 text-guia">Lo que el tope nunca frena</h2>
        <p className="mb-3 text-menor text-[var(--color-tinta-suave)]">
          Llegar al tope, o dejar de pagar, solo impide{' '}
          <strong className="font-medium text-[var(--color-tinta)]">
            abrir un expediente
          </strong>{' '}
          y{' '}
          <strong className="font-medium text-[var(--color-tinta)]">
            sumar a alguien al equipo
          </strong>
          . Todo lo demás sigue funcionando igual, porque un problema de
          facturación no puede convertirse en un término perdido.
        </p>
        <ul className="grid gap-x-8 gap-y-1 border-t border-[var(--color-regla)] pt-3 text-menor sm:grid-cols-2">
          {ACCIONES_LIBRES.map((accion) => (
            <li key={accion} className="flex gap-2">
              <span aria-hidden className="text-[var(--color-holgado)]">
                ·
              </span>
              {ACCION_ETIQUETA[accion]}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Boton, Foja, Sello } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import { entradasDelRegimen, nombresDeVerificadores } from '@/lib/catalogo/datos'
import {
  ESTADO_ETIQUETA,
  resolverCatalogo,
  resumenDelCatalogo,
  type EntradaResuelta,
  type EstadoEntrada,
} from '@/lib/catalogo/verificacion'
import { fechaLarga } from '@/lib/plazos/fecha'
import { LISTA_REGIMENES, UNIDAD_ETIQUETA, type IdRegimen } from '@/lib/plazos/regimenes'

import { retirarVerificacion } from './acciones'
import { VerificarEntrada } from './formulario'

export const metadata: Metadata = { title: 'Catálogo de plazos' }

const POR_OMISION: IdRegimen = 'mercantil'

const TONO: Record<EstadoEntrada, 'sello' | 'neutro' | 'urgente'> = {
  semilla: 'urgente',
  verificada: 'sello',
  corregida: 'sello',
  propia: 'neutro',
}

function Entrada({
  resuelta,
  regimen,
  verificadores,
  puedeVerificar,
}: {
  resuelta: EntradaResuelta
  regimen: string
  verificadores: ReadonlyMap<string, string>
  puedeVerificar: boolean
}) {
  const { entrada, estado, semilla } = resuelta
  const firmante = entrada.verificadoPor
    ? verificadores.get(entrada.verificadoPor)
    : null

  return (
    <li
      className={`bg-[var(--color-foja)] px-4 py-4 ${
        estado === 'semilla'
          ? 'border-l-2 border-l-[var(--color-urgente)]'
          : 'border-l-2 border-l-[var(--color-holgado)]'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">{entrada.etiqueta}</p>
        <Sello tono={TONO[estado]}>{ESTADO_ETIQUETA[estado]}</Sello>
      </div>

      <p className="mt-1 text-menor">
        {entrada.dias}{' '}
        {UNIDAD_ETIQUETA[entrada.unidad === 'naturales' ? 'naturales' : 'habiles']}
        {' · '}
        <span className="text-[var(--color-tinta-suave)]">{entrada.fundamento}</span>
      </p>

      {/* Si el despacho corrigió, se enseña el antes: es el dato que explica
          por qué dos despachos pueden tener números distintos. */}
      {estado === 'corregida' && semilla ? (
        <p className="mt-1 text-nota text-[var(--color-proximo)]">
          De fábrica venía: {semilla.dias}{' '}
          {UNIDAD_ETIQUETA[semilla.unidad === 'naturales' ? 'naturales' : 'habiles']},{' '}
          {semilla.fundamento}
        </p>
      ) : null}

      {entrada.verificadoEl ? (
        <p className="mt-1 text-nota text-[var(--color-tinta-suave)]">
          Verificada por {firmante ?? 'alguien del despacho'} el{' '}
          {fechaLarga(entrada.verificadoEl.slice(0, 10))}
          {entrada.verificacionNotas ? ` — ${entrada.verificacionNotas}` : ''}
        </p>
      ) : null}

      {puedeVerificar ? (
        <>
          <VerificarEntrada resuelta={resuelta} regimen={regimen} />
          {estado === 'verificada' || estado === 'corregida' ? (
            <form action={retirarVerificacion} className="mt-2">
              <input type="hidden" name="entradaId" value={entrada.id} />
              <Boton variante="fantasma" type="submit" className="px-0 py-0">
                Retirar la verificación
              </Boton>
            </form>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

export default async function PaginaCatalogo({
  searchParams,
}: {
  searchParams: Promise<{ regimen?: string }>
}) {
  const sesion = await exigirPanel()
  const { regimen: pedido } = await searchParams

  const valido = LISTA_REGIMENES.some((r) => r.id === pedido)
  const regimen = (valido ? pedido : POR_OMISION) as IdRegimen
  const meta = LISTA_REGIMENES.find((r) => r.id === regimen)

  const entradas = await entradasDelRegimen(regimen)
  const resueltas = resolverCatalogo(entradas)
  const cuenta = resumenDelCatalogo(resueltas)
  const verificadores = await nombresDeVerificadores(
    resueltas
      .map((r) => r.entrada.verificadoPor)
      .filter((id): id is string => id !== null),
  )

  const puedeVerificar =
    sesion.activa.rol === 'titular' || sesion.activa.rol === 'abogado'
  const sinVerificar = cuenta.semilla

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <h1 className="text-portada">Catálogo de plazos</h1>
        <p className="mt-2 max-w-prose text-menor text-[var(--color-tinta-suave)]">
          Litis entrega el catálogo <strong>sin verificar</strong>, y así se
          muestra en cada cómputo hasta que un abogado del despacho lo confirme.
          No es cautela de más: los ordenamientos se reforman, y el Código
          Nacional de Procedimientos Civiles y Familiares está desplazando a los
          códigos locales a ritmos distintos por entidad. Un catálogo estático
          miente.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {LISTA_REGIMENES.map((r) => (
          <Link
            key={r.id}
            href={`/panel/catalogo?regimen=${r.id}`}
            className={
              r.id === regimen
                ? 'rounded-sm border border-[var(--color-sello)] bg-[var(--color-sello-tenue)] px-3 py-1 text-menor font-medium text-[var(--color-sello)]'
                : 'rounded-sm border border-[var(--color-regla)] px-3 py-1 text-menor text-[var(--color-tinta-suave)] hover:border-[var(--color-tinta)]'
            }
          >
            {r.nombre}
          </Link>
        ))}
      </nav>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-guia">{meta?.nombre ?? regimen}</h2>
          <p className="text-menor text-[var(--color-tinta-suave)]">
            {resueltas.length} {resueltas.length === 1 ? 'entrada' : 'entradas'} ·{' '}
            {cuenta.verificada + cuenta.corregida} verificada
            {cuenta.verificada + cuenta.corregida === 1 ? '' : 's'}
          </p>
        </div>

        {sinVerificar > 0 ? (
          <div className="mt-3">
            <Aviso tono="error">
              {sinVerificar} {sinVerificar === 1 ? 'entrada sigue' : 'entradas siguen'}{' '}
              sin verificar. Los plazos que se computen con{' '}
              {sinVerificar === 1 ? 'ella' : 'ellas'} salen marcados así en el
              panel, en el expediente y en los correos de aviso — y eso es lo
              correcto hasta que alguien las revise.
            </Aviso>
          </div>
        ) : (
          <div className="mt-3">
            <Aviso tono="exito">
              Todo el régimen está verificado por el despacho.
            </Aviso>
          </div>
        )}

        {!puedeVerificar ? (
          <div className="mt-3">
            <Aviso tono="informativo">
              Verificar un plazo es acto de quien puede firmar, así que lo hace
              el titular o un abogado. Aquí puedes consultarlo.
            </Aviso>
          </div>
        ) : null}

        {resueltas.length === 0 ? (
          <Foja className="mt-4">
            <p className="text-menor text-[var(--color-tinta-suave)]">
              Este régimen todavía no tiene entradas en el catálogo. Los plazos
              se pueden capturar a mano al registrar la notificación.
            </p>
          </Foja>
        ) : (
          <ul className="mt-4 flex flex-col gap-px border-y border-[var(--color-regla)] bg-[var(--color-regla)]">
            {resueltas.map((r) => (
              <Entrada
                key={r.entrada.id}
                resuelta={r}
                regimen={regimen}
                verificadores={verificadores}
                puedeVerificar={puedeVerificar}
              />
            ))}
          </ul>
        )}
      </div>

      <p className="max-w-prose border-t border-[var(--color-regla)] pt-4 text-nota text-[var(--color-tinta-suave)]">
        Verificar no toca los plazos ya computados: cada uno guardó su
        confiabilidad el día en que se calculó, y esa constancia no se reescribe
        hacia atrás. La verificación aplica a lo que se compute de aquí en
        adelante.
      </p>
    </div>
  )
}

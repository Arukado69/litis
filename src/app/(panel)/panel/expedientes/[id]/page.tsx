import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Aviso, Boton, Dato, Foja, Rotulo, Sello } from '@/components/ui/primitivos'
import type { AudienciaEnAgenda } from '@/lib/audiencias/agenda'
import { ESTADO_AUDIENCIA_ETIQUETA } from '@/lib/audiencias/audiencias'
import { audienciasDelExpediente } from '@/lib/audiencias/datos'
import { exigirPanel } from '@/lib/auth/sesion'
import { TIPO_ACTUACION_ETIQUETA } from '@/lib/bitacora/captura'
import {
  bitacoraDelExpediente,
  documentosDelExpediente,
  type ActuacionEnBitacora,
  type DocumentoDelExpediente,
} from '@/lib/bitacora/datos'
import {
  TIPO_DOCUMENTO_ETIQUETA,
  tamanoLegible,
} from '@/lib/documentos/archivos'
import {
  miembrosDelDespacho,
  obtenerExpediente,
  plazosDelExpediente,
  type PlazoDelExpediente,
} from '@/lib/expedientes/datos'
import {
  ESTADO_EXPEDIENTE_ETIQUETA,
  RESULTADO_ETIQUETA,
} from '@/lib/expedientes/edicion'
import { avance } from '@/lib/expedientes/etapas'
import {
  buscarVia,
  FUERO_ETIQUETA,
  MATERIAS,
  type Fuero,
  type IdMateria,
} from '@/lib/expedientes/materias'
import { ROL_ETIQUETA, type RolParte } from '@/lib/expedientes/partes'
import { fechaLarga, fechaLargaConDia } from '@/lib/plazos/fecha'
import type { EstadoPlazo, RolMembresia } from '@/types/db'

import { CerrarAudiencia, SenalarAudiencia } from './audiencias'
import { AsentarActuacion, SubirDocumento } from './bitacora'
import { CerrarPlazo } from './cerrar-plazo'

export const metadata: Metadata = { title: 'Expediente' }

/** Quién puede sacar un plazo de la vigilancia. Lo hace cumplir la acción. */
const PUEDE_CANCELAR: readonly RolMembresia[] = ['titular', 'abogado']

const ESTADO_PLAZO_ETIQUETA: Record<EstadoPlazo, string> = {
  pendiente: 'Corriendo',
  atendido: 'Atendido',
  vencido: 'Vencido sin atender',
  cancelado: 'Cancelado',
}

function FilaPlazo({ p }: { p: PlazoDelExpediente }) {
  const cerrado = p.estado !== 'pendiente'
  return (
    <div
      className={`border-l-2 py-2 pl-3 ${
        cerrado
          ? 'border-[var(--color-regla)] text-[var(--color-tinta-suave)]'
          : 'border-[var(--color-tinta)]'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <span className="font-medium">{p.etiqueta}</span>
        <span className="text-menor">
          {cerrado ? 'Vencía' : 'Vence'} el {fechaLargaConDia(p.fechaVencimiento)}
        </span>
      </div>
      <p className="mt-0.5 text-nota text-[var(--color-tinta-suave)]">
        {ESTADO_PLAZO_ETIQUETA[p.estado]}
        {p.atendidoEl ? ` el ${fechaLarga(p.atendidoEl.slice(0, 10))}` : ''} ·
        notificado el {fechaLarga(p.fechaNotificacion)}
        {p.responsableNombre ? ` · ${p.responsableNombre}` : ''}
        {p.confiabilidad === 'semilla_no_verificada'
          ? ' · cómputo sin verificar'
          : ''}
      </p>
      {/* Un vencimiento corregido a mano tiene que decir que lo fue, y por
          qué: si no, la fecha aparenta salir del motor. */}
      {p.ajustada ? (
        <p className="mt-1 text-nota text-[var(--color-proximo)]">
          Fecha ajustada a mano — {p.motivoAjuste}
        </p>
      ) : null}
    </div>
  )
}

function RenglonAudiencia({
  a,
  cerrable,
}: {
  a: AudienciaEnAgenda
  cerrable: boolean
}) {
  return (
    <li
      className={
        cerrable
          ? 'margen bg-[var(--color-foja)] py-3 pl-4 pr-3'
          : 'border-l-2 border-[var(--color-regla)] py-2 pl-4 text-[var(--color-tinta-suave)]'
      }
      data-urgencia={cerrable ? 'inminente' : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={cerrable ? 'font-medium' : ''}>
          {a.tipo}
          {!cerrable ? (
            <span className="ml-2 align-middle">
              <Sello tono="neutro">{ESTADO_AUDIENCIA_ETIQUETA[a.estado]}</Sello>
            </span>
          ) : null}
        </p>
        <p className="text-menor">
          {fechaLargaConDia(a.fecha)}
          {a.hora ? `, ${a.hora}` : ''}
        </p>
      </div>
      <p className="mt-0.5 text-nota text-[var(--color-tinta-suave)]">
        {a.lugar ?? 'Sin lugar capturado'}
        {' · '}
        {a.responsableNombre ?? (
          <span className="font-medium text-[var(--color-urgente)]">
            Nadie asignado
          </span>
        )}
      </p>
      {cerrable ? <CerrarAudiencia audienciaId={a.id} fecha={a.fecha} /> : null}
    </li>
  )
}

function RenglonActuacion({ a }: { a: ActuacionEnBitacora }) {
  return (
    <li className="border-l-2 border-[var(--color-regla)] py-2.5 pl-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">{a.titulo}</p>
        <p className="text-menor text-[var(--color-tinta-suave)]">
          {fechaLarga(a.fecha)}
        </p>
      </div>
      {a.detalle ? (
        <p className="mt-1 whitespace-pre-line text-menor text-[var(--color-tinta-suave)]">
          {a.detalle}
        </p>
      ) : null}
      <p className="mt-1 flex flex-wrap items-center gap-2 text-nota text-[var(--color-tinta-suave)]">
        <span>{TIPO_ACTUACION_ETIQUETA[a.tipo]}</span>
        {a.autorNombre ? <span>· {a.autorNombre}</span> : null}
        {/* Que el cliente lo vea es un hecho del expediente, no un ajuste: se
            marca a la vista para que nadie se pregunte qué está compartido. */}
        {a.visibleCliente ? <Sello>visible para el cliente</Sello> : null}
      </p>
    </li>
  )
}

function RenglonDocumento({
  d,
  amparados,
}: {
  d: DocumentoDelExpediente
  amparados: ReadonlyMap<string, string>
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-[var(--color-foja)] px-4 py-3">
      <div>
        <p className="font-medium">
          {d.nombre}
          {d.version > 1 ? (
            <span className="ml-2 align-middle">
              <Sello tono="neutro">versión {d.version}</Sello>
            </span>
          ) : null}
          {d.visibleCliente ? (
            <span className="ml-2 align-middle">
              <Sello>visible para el cliente</Sello>
            </span>
          ) : null}
        </p>
        <p className="text-nota text-[var(--color-tinta-suave)]">
          {TIPO_DOCUMENTO_ETIQUETA[d.tipo]}
          {d.tamanoBytes ? ` · ${tamanoLegible(d.tamanoBytes)}` : ''}
          {d.autorNombre ? ` · ${d.autorNombre}` : ''}
          {` · ${fechaLarga(d.creadoEl.slice(0, 10))}`}
          {d.acuseDeId && amparados.get(d.acuseDeId)
            ? ` · acuse de "${amparados.get(d.acuseDeId)}"`
            : ''}
        </p>
        {d.notas ? (
          <p className="mt-1 text-nota text-[var(--color-tinta-suave)]">{d.notas}</p>
        ) : null}
      </div>

      {/* Un enlace, no un formulario: la CSP lleva `form-action 'self'` y los
          navegadores no coinciden en si eso alcanza a la redirección que sigue
          al envío. El servidor firma un enlace que dura un minuto. */}
      <a href={`/api/documentos/${d.id}`}>
        <Boton variante="secundario" type="button">
          Descargar
        </Boton>
      </a>
    </li>
  )
}

export default async function PaginaExpediente({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await exigirPanel()
  const { id } = await params
  const [expediente, plazos, bitacora, documentos, audiencias, miembros] =
    await Promise.all([
      obtenerExpediente(id),
      plazosDelExpediente(id),
      bitacoraDelExpediente(id),
      documentosDelExpediente(id),
      audienciasDelExpediente(id),
      miembrosDelDespacho(sesion.activa.despachoId),
    ])

  // `obtenerExpediente` no distingue "no existe" de "no tienes acceso", y aquí
  // tampoco: decirle a alguien que el expediente existe pero no puede verlo ya
  // es filtrar la existencia de un asunto ajeno.
  if (!expediente) notFound()

  const puedeCancelar = PUEDE_CANCELAR.includes(sesion.activa.rol)
  const corriendo = plazos.filter((p) => p.estado === 'pendiente')
  const cerrados = plazos.filter((p) => p.estado !== 'pendiente')

  const via = buscarVia(expediente.via)
  const progreso = Math.round(
    avance(expediente.via, expediente.etapaActual ?? '') * 100,
  )
  const etapaActual = expediente.etapas.find(
    (e) => e.clave === expediente.etapaActual,
  )
  const paralelas = expediente.etapas.filter((e) => e.paralela)
  const nombresDeDocumentos = new Map(documentos.map((d) => [d.id, d.nombre]))
  const programadas = audiencias.filter((a) => a.estado === 'programada')
  const audienciasPasadas = audiencias.filter((a) => a.estado !== 'programada')

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <Link
          href="/panel/expedientes"
          className="text-menor text-[var(--color-tinta-suave)] underline decoration-[var(--color-regla-fuerte)] underline-offset-4"
        >
          Volver a expedientes
        </Link>

        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-rotulo">{expediente.caratula}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-menor text-[var(--color-tinta-suave)]">
              <span>{expediente.numeroInterno}</span>
              {expediente.numeroOrgano ? (
                <span>· {expediente.numeroOrgano}</span>
              ) : (
                <Sello tono="neutro">sin número de juzgado</Sello>
              )}
              {expediente.estado !== 'activo' ? (
                <Sello>{ESTADO_EXPEDIENTE_ETIQUETA[expediente.estado]}</Sello>
              ) : null}
              {expediente.resultado ? (
                <Sello>{RESULTADO_ETIQUETA[expediente.resultado]}</Sello>
              ) : null}
            </p>
          </div>

          <div className="flex gap-3">
            <Link href={`/panel/expedientes/${id}/editar`}>
              <Boton variante="secundario">Editar</Boton>
            </Link>
            <Link href={`/panel/expedientes/${id}/notificacion`}>
              <Boton>Registrar notificación</Boton>
            </Link>
          </div>
        </div>
      </div>

      <Foja>
        <Rotulo>Plazos</Rotulo>
        {plazos.length === 0 ? (
          <p className="mt-3 text-menor text-[var(--color-tinta-suave)]">
            Ninguno todavía. Registra una notificación y el sistema computa su
            plazo con la traza a la vista.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4">
            {corriendo.length === 0 ? (
              <p className="text-menor text-[var(--color-tinta-suave)]">
                Ningún plazo corriendo ahora mismo.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {corriendo.map((p) => (
                  <li key={p.id}>
                    <FilaPlazo p={p} />
                    <CerrarPlazo plazoId={p.id} puedeCancelar={puedeCancelar} />
                  </li>
                ))}
              </ul>
            )}

            {/* Los cerrados no se borran ni se esconden: se apartan. Son el
                historial del asunto, y ahí está escrito lo que se presentó
                tarde. */}
            {cerrados.length > 0 ? (
              <details className="text-menor">
                <summary className="cursor-pointer text-[var(--color-tinta-suave)]">
                  {cerrados.length} plazo{cerrados.length === 1 ? '' : 's'}{' '}
                  cerrado{cerrados.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 flex flex-col gap-2">
                  {cerrados.map((p) => (
                    <li key={p.id}>
                      <FilaPlazo p={p} />
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}
      </Foja>

      {expediente.restringido ? (
        <Aviso tono="informativo">
          Asunto restringido: solo el responsable, el titular y quien tenga
          acceso expreso pueden abrirlo.
        </Aviso>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Foja className="lg:col-span-2">
          <Rotulo>El asunto</Rotulo>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Dato etiqueta="Materia">
              {MATERIAS[expediente.materia as IdMateria]?.nombre ??
                expediente.materia}
            </Dato>
            <Dato etiqueta="Vía">{via?.nombre ?? expediente.via}</Dato>
            <Dato etiqueta="Fuero">
              {FUERO_ETIQUETA[expediente.fuero as Fuero] ?? expediente.fuero}
            </Dato>
            <Dato etiqueta="Entidad">{expediente.entidad ?? '—'}</Dato>
            <Dato etiqueta="Instancia">{expediente.instancia ?? '—'}</Dato>
            <Dato etiqueta="Cuantía">
              {expediente.cuantia === null
                ? '—'
                : expediente.cuantia.toLocaleString('es-MX', {
                    style: 'currency',
                    currency: 'MXN',
                  })}
            </Dato>
            <Dato etiqueta="Responsable">
              {expediente.responsableNombre ?? (
                <span className="text-[var(--color-urgente)]">
                  Sin asignar
                </span>
              )}
            </Dato>
            <Dato etiqueta="Inicio">
              {expediente.fechaInicio ? fechaLarga(expediente.fechaInicio) : '—'}
            </Dato>
            {expediente.fechaConclusion ? (
              <Dato etiqueta="Conclusión">
                {fechaLarga(expediente.fechaConclusion)}
              </Dato>
            ) : null}
          </dl>

          {expediente.notas ? (
            <p className="mt-5 border-t border-[var(--color-regla)] pt-4 text-menor text-[var(--color-tinta-suave)]">
              {expediente.notas}
            </p>
          ) : null}
        </Foja>

        <Foja>
          <Rotulo>Partes</Rotulo>
          <ul className="mt-4 flex flex-col gap-3 text-menor">
            {expediente.partes.map((p) => (
              <li key={p.id}>
                <div className="font-medium">
                  {p.nombre}
                  {p.esNuestraParte ? (
                    <span className="ml-2 align-middle">
                      <Sello>nuestra parte</Sello>
                    </span>
                  ) : null}
                </div>
                <div className="text-nota text-[var(--color-tinta-suave)]">
                  {ROL_ETIQUETA[p.rol as RolParte] ?? p.rol}
                  {p.abogadoContrario ? ` · abogado: ${p.abogadoContrario}` : ''}
                </div>
              </li>
            ))}
          </ul>
        </Foja>
      </div>

      <Foja>
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Rotulo>Etapas</Rotulo>
          <span className="text-menor text-[var(--color-tinta-suave)]">
            {etapaActual ? etapaActual.nombre : 'Sin etapa'} · {progreso}% del
            avance
          </span>
        </div>

        {/* Numeradas porque el juicio SÍ es una secuencia: la etapa cuatro no
            se alcanza sin pasar por la tres. Las paralelas van aparte,
            justamente porque no ocupan un lugar en esa cuenta. */}
        <ol className="mt-4 flex flex-col">
          {expediente.etapas
            .filter((e) => !e.paralela)
            .map((e, i) => {
              const esActual = e.clave === expediente.etapaActual
              return (
                <li
                  key={e.clave}
                  className={`flex gap-4 border-l-2 py-2 pl-4 ${
                    esActual
                      ? 'border-[var(--color-sello)]'
                      : 'border-[var(--color-regla)]'
                  }`}
                >
                  <span
                    className={`w-5 shrink-0 text-menor ${
                      esActual
                        ? 'text-[var(--color-sello)]'
                        : 'text-[var(--color-tinta-suave)]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className={esActual ? 'font-medium' : ''}>{e.nombre}</p>
                    {e.descripcion ? (
                      <p className="text-nota text-[var(--color-tinta-suave)]">
                        {e.descripcion}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
        </ol>

        {paralelas.length > 0 ? (
          <div className="mt-5 border-t border-[var(--color-regla)] pt-4">
            <p className="text-menor font-medium">Corren en paralelo</p>
            <p className="mt-0.5 text-nota text-[var(--color-tinta-suave)]">
              El asunto no está en ellas: las tiene, sin dejar de avanzar por su
              propia etapa.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {paralelas.map((e) => (
                <li key={e.clave}>
                  <Sello tono="neutro">{e.nombre}</Sello>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Foja>

      <Foja className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Rotulo>Audiencias</Rotulo>
          <span className="text-menor text-[var(--color-tinta-suave)]">
            {programadas.length === 0
              ? 'Ninguna señalada'
              : `${programadas.length} ${programadas.length === 1 ? 'señalada' : 'señaladas'}`}
          </span>
        </div>

        {programadas.length === 0 ? (
          <p className="text-menor text-[var(--color-tinta-suave)]">
            No hay ninguna señalada. Al capturarla aparece en la agenda junto
            con los vencimientos, que es donde se ve si chocan.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {programadas.map((a) => (
              <RenglonAudiencia key={a.id} a={a} cerrable />
            ))}
          </ul>
        )}

        {audienciasPasadas.length > 0 ? (
          <details className="text-menor">
            <summary className="cursor-pointer text-[var(--color-tinta-suave)]">
              {audienciasPasadas.length} anterior
              {audienciasPasadas.length === 1 ? '' : 'es'}
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {audienciasPasadas.map((a) => (
                <RenglonAudiencia key={a.id} a={a} cerrable={false} />
              ))}
            </ul>
          </details>
        ) : null}

        <SenalarAudiencia
          expedienteId={id}
          miembros={miembros.map((m) => ({ valor: m.perfilId, etiqueta: m.nombre }))}
        />
      </Foja>

      <Foja className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Rotulo>Documentos</Rotulo>
          <span className="text-menor text-[var(--color-tinta-suave)]">
            {documentos.length === 0
              ? 'Ninguno'
              : `${documentos.length} ${documentos.length === 1 ? 'archivo' : 'archivos'}`}
          </span>
        </div>

        {documentos.length === 0 ? (
          <p className="text-menor text-[var(--color-tinta-suave)]">
            Todavía no hay ninguno. Se guardan en un almacén privado y se
            descargan con un enlace que dura un minuto.
          </p>
        ) : (
          <ul className="flex flex-col gap-px border-y border-[var(--color-regla)] bg-[var(--color-regla)]">
            {documentos.map((d) => (
              <RenglonDocumento key={d.id} d={d} amparados={nombresDeDocumentos} />
            ))}
          </ul>
        )}

        <SubirDocumento
          expedienteId={id}
          documentos={documentos.map((d) => ({
            id: d.id,
            nombre: d.nombre,
            version: d.version,
          }))}
        />
      </Foja>

      <Foja className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <Rotulo>Bitácora</Rotulo>
          <span className="text-menor text-[var(--color-tinta-suave)]">
            {bitacora.length === 0
              ? 'Vacía'
              : `${bitacora.length} ${bitacora.length === 1 ? 'actuación' : 'actuaciones'}`}
          </span>
        </div>

        {bitacora.length === 0 ? (
          <p className="text-menor text-[var(--color-tinta-suave)]">
            Todavía no hay nada asentado. Se llena sola conforme registras
            notificaciones y cierras plazos, y puedes asentar a mano lo demás.
          </p>
        ) : (
          <ol className="flex flex-col">
            {bitacora.map((a) => (
              <RenglonActuacion key={a.id} a={a} />
            ))}
          </ol>
        )}

        <AsentarActuacion expedienteId={id} />
      </Foja>
    </div>
  )
}

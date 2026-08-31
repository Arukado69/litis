'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  Area,
  Aviso,
  Boton,
  Campo,
  Casilla,
  Foja,
  Rotulo,
  Selector,
  type Opcion,
} from '@/components/ui/primitivos'
import {
  ESTADO_EXPEDIENTE_ETIQUETA,
  RESULTADO_ETIQUETA,
} from '@/lib/expedientes/edicion'
import { hoyEnMexico } from '@/lib/plazos/fecha'
import type { EstadoExpediente } from '@/types/db'

import type { HallazgoVisible } from '../../nuevo/estado'
import { agregarParte, guardarExpediente } from './acciones'
import {
  ESTADO_INICIAL_EDICION,
  ESTADO_INICIAL_PARTE,
  type EstadoParte,
} from './estado'

const ESTADOS: Opcion[] = (
  Object.keys(ESTADO_EXPEDIENTE_ETIQUETA) as EstadoExpediente[]
).map((e) => ({ valor: e, etiqueta: ESTADO_EXPEDIENTE_ETIQUETA[e] }))

const RESULTADOS: Opcion[] = Object.entries(RESULTADO_ETIQUETA).map(
  ([valor, etiqueta]) => ({ valor, etiqueta }),
)

const TERMINADOS: readonly string[] = ['concluido', 'archivado']

function BotonEnviar({ children }: { children: string }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending ? 'Guardando…' : children}
    </Boton>
  )
}

export interface DatosDelEditor {
  expedienteId: string
  numeroOrgano: string
  instancia: string
  entidad: string
  cuantia: string
  responsableId: string
  restringido: boolean
  notas: string
  estado: EstadoExpediente
  resultado: string
  fechaConclusion: string
  etapaActual: string
  /** Solo las del avance: una paralela no puede ser la etapa actual. */
  etapas: readonly Opcion[]
  miembros: readonly Opcion[]
  roles: readonly Opcion[]
}

/**
 * El editor del expediente.
 *
 * Un solo formulario, no un campo con lapicito por dato: quien captura el
 * número del juzgado suele capturar también la instancia y mover la etapa, en
 * la misma sentada de veinte segundos después de leer el acuerdo de admisión.
 */
export function FormularioEdicion({ datos }: { datos: DatosDelEditor }) {
  const [estado, enviar] = useActionState(
    guardarExpediente,
    ESTADO_INICIAL_EDICION,
  )
  const [situacion, setSituacion] = useState<string>(datos.estado)
  const v = estado.valores

  return (
    <form action={enviar} className="flex flex-col gap-6">
      <input type="hidden" name="expedienteId" value={datos.expedienteId} />

      {estado.guardado ? <Aviso tono="exito">{estado.guardado}</Aviso> : null}
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <Foja className="flex flex-col gap-4">
        <Rotulo>Ante quién se sigue</Rotulo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Número del órgano"
            nombre="numeroOrgano"
            defaultValue={v.numeroOrgano ?? datos.numeroOrgano}
            placeholder="431/2026"
            ayuda="El que asigna el juzgado al admitir. Nace vacío."
          />
          <Campo
            etiqueta="Instancia"
            nombre="instancia"
            defaultValue={v.instancia ?? datos.instancia}
            placeholder="Primera instancia, Toca 12/2026, Amparo directo"
          />
          <Campo
            etiqueta="Entidad"
            nombre="entidad"
            defaultValue={v.entidad ?? datos.entidad}
          />
          <Campo
            etiqueta="Cuantía"
            nombre="cuantia"
            defaultValue={v.cuantia ?? datos.cuantia}
            placeholder="$250,000.00"
          />
        </div>
      </Foja>

      <Foja className="flex flex-col gap-4">
        <Rotulo>Cómo va</Rotulo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Etapa actual"
            nombre="etapaActual"
            opciones={datos.etapas}
            defaultValue={v.etapaActual ?? datos.etapaActual}
            error={estado.problemas.etapaActual}
            vacio="Sin etapa"
            ayuda="Las etapas que corren en paralelo —suspensión, incidentes— no aparecen aquí: el asunto no está en ellas, las tiene."
          />
          <Selector
            etiqueta="Responsable"
            nombre="responsableId"
            opciones={datos.miembros}
            defaultValue={v.responsableId ?? datos.responsableId}
            vacio="Sin responsable"
          />
          <Selector
            etiqueta="Situación del asunto"
            nombre="estado"
            opciones={ESTADOS}
            defaultValue={situacion}
            onChange={(e) => setSituacion(e.target.value)}
            error={estado.problemas.estado}
            vacio={null}
          />
          {TERMINADOS.includes(situacion) ? (
            <>
              <Selector
                etiqueta="Resultado"
                nombre="resultado"
                opciones={RESULTADOS}
                defaultValue={v.resultado ?? datos.resultado}
                error={estado.problemas.resultado}
                vacio="Elige…"
                ayuda="Es el dato que después nadie vuelve a capturar."
              />
              <Campo
                etiqueta="Fecha de conclusión"
                nombre="fechaConclusion"
                type="date"
                max={hoyEnMexico()}
                defaultValue={v.fechaConclusion ?? datos.fechaConclusion}
                error={estado.problemas.fechaConclusion}
                ayuda="Si la dejas vacía se pone la de hoy."
              />
            </>
          ) : null}
        </div>

        <Casilla
          etiqueta="Asunto restringido"
          nombre="restringido"
          defaultChecked={datos.restringido}
          ayuda="Solo el responsable, el titular y quien tenga acceso expreso pueden abrirlo."
        />

        <Area
          etiqueta="Notas internas"
          nombre="notas"
          defaultValue={v.notas ?? datos.notas}
          rows={4}
        />
      </Foja>

      <div className="flex items-center gap-4">
        <BotonEnviar>Guardar cambios</BotonEnviar>
        <p className="text-nota text-[var(--color-tinta-suave)]">
          Cambiar el responsable, la etapa, el número del órgano o la situación
          queda anotado en la bitácora.
        </p>
      </div>
    </form>
  )
}

function AvisoConflictos({ hallazgos }: { hallazgos: readonly HallazgoVisible[] }) {
  return (
    <div className="flex flex-col gap-3">
      <Aviso tono="error">
        Esta persona ya figura en el padrón del despacho. Revísalo antes de
        agregarla: representar a las dos partes de un mismo interés es un
        impedimento, no un descuido administrativo.
      </Aviso>
      <ul className="flex flex-col gap-2 text-menor">
        {hallazgos.map((h, i) => (
          <li
            key={`${h.nombreRegistro}-${i}`}
            className="border-l-2 border-[var(--color-urgente)] pl-3"
          >
            <p className="font-medium">{h.nombreRegistro}</p>
            <p className="text-[var(--color-tinta-suave)]">
              {h.caratula} — {h.motivo}
            </p>
          </li>
        ))}
      </ul>
      <Casilla
        etiqueta="Lo revisé y no hay impedimento"
        nombre="conflictoRevisado"
        ayuda="Queda asentado en la bitácora con tu nombre."
      />
    </div>
  )
}

export function FormularioParte({
  expedienteId,
  roles,
}: {
  expedienteId: string
  roles: readonly Opcion[]
}) {
  const [estado, enviar] = useActionState<EstadoParte, FormData>(
    agregarParte,
    ESTADO_INICIAL_PARTE,
  )
  const v = estado.valores

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="expedienteId" value={expedienteId} />

      {estado.guardado ? <Aviso tono="exito">{estado.guardado}</Aviso> : null}
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Nombre"
          nombre="nombre"
          defaultValue={v.nombre ?? ''}
          error={estado.problemas.nombre}
          placeholder="Constructora XYZ, S.A. de C.V."
        />
        <Selector
          etiqueta="Comparece como"
          nombre="rol"
          opciones={roles}
          defaultValue={v.rol ?? ''}
          error={estado.problemas.rol}
        />
        <Selector
          etiqueta="Persona"
          nombre="tipo"
          opciones={[
            { valor: 'fisica', etiqueta: 'Física' },
            { valor: 'moral', etiqueta: 'Moral' },
          ]}
          defaultValue={v.tipo ?? 'fisica'}
          vacio={null}
        />
        <Campo etiqueta="RFC" nombre="rfc" defaultValue={v.rfc ?? ''} />
        <Campo
          etiqueta="Abogado que la patrocina"
          nombre="abogadoContrario"
          defaultValue={v.abogadoContrario ?? ''}
        />
      </div>

      <Casilla
        etiqueta="Es nuestra parte"
        nombre="esNuestraParte"
        defaultChecked={v.esNuestraParte === 'on'}
      />

      {estado.conflictos ? <AvisoConflictos hallazgos={estado.conflictos} /> : null}

      <div>
        <BotonEnviar>
          {estado.conflictos ? 'Agregar de todos modos' : 'Agregar parte'}
        </BotonEnviar>
      </div>
    </form>
  )
}

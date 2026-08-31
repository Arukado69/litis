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
import {
  FUERO_ETIQUETA,
  LISTA_MATERIAS,
  viasDeMateria,
  type IdMateria,
} from '@/lib/expedientes/materias'
import { ROLES_POR_MATERIA, ROL_ETIQUETA } from '@/lib/expedientes/partes'

import { abrirExpediente } from './acciones'
import { ESTADO_INICIAL, type HallazgoVisible } from './estado'

function BotonEnviar({ hayConflictos }: { hayConflictos: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Boton type="submit" disabled={pending}>
      {pending
        ? 'Guardando…'
        : hayConflictos
          ? 'Revisé y continúo'
          : 'Abrir expediente'}
    </Boton>
  )
}

/**
 * Los hallazgos de conflicto se muestran ANTES de guardar y con su evidencia.
 * No se bloquea el alta: decidir si un conflicto es dispensable es criterio
 * profesional, no salida de una función. Pero seguir adelante exige marcar la
 * casilla, y eso queda asentado en la bitácora del expediente.
 */
function BloqueConflictos({ hallazgos }: { hallazgos: HallazgoVisible[] }) {
  const hayImpedimento = hallazgos.some((h) => h.nivel === 'impedimento')

  return (
    <Foja className="flex flex-col gap-3 border-[var(--color-urgente)]/40">
      <div>
        <h2 className="font-medium text-[var(--color-urgente)]">
          {hayImpedimento
            ? 'Posible impedimento'
            : 'Coincidencias por revisar'}
        </h2>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          Antes de abrir el expediente, revisa estas coincidencias con tu
          padrón. Nada se ha guardado todavía.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {hallazgos.map((h, i) => (
          <li
            key={`${h.nombreRegistro}-${i}`}
            className="rounded-md border border-[var(--color-regla)] bg-[var(--color-tenue)] p-3 text-menor"
          >
            <p className="font-medium">
              {h.nombreParte} ↔ {h.nombreRegistro}
            </p>
            <p className="mt-1 text-[var(--color-tinta-suave)]">{h.motivo}</p>
            <p className="mt-1 text-nota text-[var(--color-tinta-suave)]">
              Coincidió por: {h.coincidencia.replace('_', ' ')} · En:{' '}
              {h.caratula}
            </p>
          </li>
        ))}
      </ul>

      <Casilla
        etiqueta="Revisé estas coincidencias y procede abrir el expediente"
        nombre="conflictoRevisado"
        required
        ayuda="Queda asentado en la bitácora quién lo revisó y qué se mostró."
      />
    </Foja>
  )
}

export function FormularioAlta({
  miembros,
}: {
  miembros: readonly Opcion[]
}) {
  const [estado, accion] = useActionState(abrirExpediente, ESTADO_INICIAL)
  const [materia, setMateria] = useState<IdMateria | ''>('')

  /**
   * Lo capturado, de vuelta. React 19 resetea el formulario tras la acción y
   * cada campo vuelve a su `defaultValue`; poniendo aquí lo ya tecleado, el
   * reset lo restaura en vez de vaciarlo. La materia no lo necesita: es un
   * `select` controlado y el componente no se desmonta.
   */
  const v = (clave: string) => estado.valores[clave] ?? ''

  // Vías y roles dependen de la materia. Ofrecer todas las vías de golpe
  // invita a elegir una que no corresponde, y el rol "quejoso" no significa
  // nada en un juicio mercantil.
  const vias: Opcion[] = materia
    ? viasDeMateria(materia).map((via) => ({ valor: via.id, etiqueta: via.nombre }))
    : []
  const roles: Opcion[] = materia
    ? (ROLES_POR_MATERIA[materia] ?? []).map((r) => ({
        valor: r,
        etiqueta: ROL_ETIQUETA[r],
      }))
    : []

  return (
    <form action={accion} className="flex flex-col gap-6">
      {estado.error ? <Aviso tono="error">{estado.error}</Aviso> : null}

      {estado.conflictos ? (
        <BloqueConflictos hallazgos={estado.conflictos} />
      ) : null}

      <Foja className="flex flex-col gap-4">
        <h2 className="font-medium">El asunto</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Materia"
            nombre="materia"
            required
            value={materia}
            onChange={(e) => setMateria(e.target.value as IdMateria)}
            error={estado.problemas.materia}
            opciones={LISTA_MATERIAS.map((m) => ({
              valor: m.id,
              etiqueta: m.nombre,
            }))}
          />
          <Selector
            etiqueta="Vía"
            nombre="via"
            defaultValue={v('via')}
            required
            disabled={!materia}
            error={estado.problemas.via}
            opciones={vias}
            vacio={materia ? 'Elige…' : 'Primero elige materia'}
            ayuda="Determina las etapas y el régimen de cómputo de plazos."
          />
          <Selector
            etiqueta="Fuero"
            nombre="fuero"
            required
            defaultValue={v('fuero') || 'comun'}
            vacio={null}
            error={estado.problemas.fuero}
            opciones={[
              { valor: 'comun', etiqueta: FUERO_ETIQUETA.comun },
              { valor: 'federal', etiqueta: FUERO_ETIQUETA.federal },
            ]}
          />
          <Campo etiqueta="Entidad" nombre="entidad"
            defaultValue={v('entidad')} placeholder="Ciudad de México" />
          <Campo
            etiqueta="Número del órgano"
            nombre="numeroOrgano"
            defaultValue={v('numeroOrgano')}
            placeholder="123/2026"
            ayuda="Déjalo vacío si aún no se admite la demanda."
          />
          <Campo
            etiqueta="Instancia"
            nombre="instancia"
            defaultValue={v('instancia')}
            placeholder="Primera instancia"
          />
          <Campo etiqueta="Cuantía" nombre="cuantia"
            defaultValue={v('cuantia')} placeholder="$500,000.00" />
          <Campo etiqueta="Fecha de inicio" nombre="fechaInicio"
            defaultValue={v('fechaInicio')} type="date" />
        </div>
      </Foja>

      <Foja className="flex flex-col gap-4">
        <h2 className="font-medium">A quién representas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Nombre"
            nombre="clienteNombre"
            defaultValue={v('clienteNombre')}
            required
            error={estado.problemas.clienteNombre}
          />
          <Selector
            etiqueta="Tipo"
            nombre="clienteTipo"
            defaultValue={v('clienteTipo') || 'fisica'}
            vacio={null}
            opciones={[
              { valor: 'fisica', etiqueta: 'Persona física' },
              { valor: 'moral', etiqueta: 'Persona moral' },
            ]}
          />
          <Selector
            etiqueta="Carácter"
            nombre="clienteRol"
            defaultValue={v('clienteRol')}
            required
            disabled={!materia}
            error={estado.problemas.clienteRol}
            opciones={roles}
            vacio={materia ? 'Elige…' : 'Primero elige materia'}
          />
          <Campo etiqueta="RFC" nombre="clienteRfc"
            defaultValue={v('clienteRfc')} />
        </div>
      </Foja>

      <Foja className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">La contraparte</h2>
          <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
            Opcional, pero captúrala en cuanto la sepas: sin ella no se puede
            detectar un conflicto de interés más adelante.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre" nombre="contraparteNombre"
            defaultValue={v('contraparteNombre')} />
          <Selector
            etiqueta="Tipo"
            nombre="contraparteTipo"
            defaultValue={v('contraparteTipo') || 'fisica'}
            vacio={null}
            opciones={[
              { valor: 'fisica', etiqueta: 'Persona física' },
              { valor: 'moral', etiqueta: 'Persona moral' },
            ]}
          />
          <Selector
            etiqueta="Carácter"
            nombre="contraparteRol"
            defaultValue={v('contraparteRol')}
            disabled={!materia}
            error={estado.problemas.contraparteRol}
            opciones={roles}
            vacio={materia ? 'Elige…' : 'Primero elige materia'}
          />
          <Campo etiqueta="RFC" nombre="contraparteRfc"
            defaultValue={v('contraparteRfc')} />
          <Campo
            etiqueta="Abogado de la contraparte"
            nombre="contraparteAbogado"
            defaultValue={v('contraparteAbogado')}
            ayuda="Con quién se negocia."
          />
        </div>
      </Foja>

      <Foja className="flex flex-col gap-4">
        <h2 className="font-medium">Interno</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector
            etiqueta="Abogado responsable"
            nombre="responsableId"
            defaultValue={v('responsableId')}
            opciones={miembros}
            ayuda="Sin responsable, los plazos no tendrán a quién avisarle."
          />
          <Campo
            etiqueta="Carátula"
            nombre="caratula"
            defaultValue={v('caratula')}
            ayuda="Si la dejas vacía se arma con las partes."
          />
        </div>
        <Area etiqueta="Notas" nombre="notas"
            defaultValue={v('notas')} />
        <Casilla
          etiqueta="Asunto restringido"
          nombre="restringido"
          ayuda="Solo tú, el titular y quien autorices podrán abrirlo."
        />
      </Foja>

      <div className="flex justify-end">
        <BotonEnviar hayConflictos={estado.conflictos !== null} />
      </div>
    </form>
  )
}

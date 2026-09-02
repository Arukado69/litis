import type { Metadata } from 'next'
import Link from 'next/link'

import { Aviso, Boton, Foja, Rotulo, Sello } from '@/components/ui/primitivos'
import { exigirPanel } from '@/lib/auth/sesion'
import {
  cargaPorPersona,
  equipoDelDespacho,
  invitacionesPendientes,
} from '@/lib/despachos/equipo'
import {
  ROLES_INVITABLES,
  ROL_ALCANCE,
  ROL_MEMBRESIA_ETIQUETA,
  estaVigente,
  puedeCambiarRol,
  puedeDarDeBaja,
} from '@/lib/despachos/invitaciones'
import { fechaLarga } from '@/lib/plazos/fecha'
import { suscripcionYConsumo } from '@/lib/suscripcion/datos'
import { asientosLibres, puedeSumarAsiento } from '@/lib/suscripcion/limites'

import { cambiarRol, darDeBaja, reactivar, revocarInvitacion } from './acciones'
import { FormularioInvitar } from './formulario'

export const metadata: Metadata = { title: 'Equipo' }

/** `2026-09-10T12:00:00Z` → `10 de septiembre de 2026`. */
function dia(marca: string): string {
  return fechaLarga(marca.slice(0, 10))
}

export default async function PaginaEquipo() {
  const sesion = await exigirPanel()
  const despachoId = sesion.activa.despachoId
  const esTitular = sesion.activa.rol === 'titular'

  const [equipo, pendientes, carga, cobro] = await Promise.all([
    equipoDelDespacho(despachoId),
    esTitular ? invitacionesPendientes(despachoId) : Promise.resolve([]),
    cargaPorPersona(despachoId),
    suscripcionYConsumo(despachoId),
  ])

  // El asiento se aparta al invitar, no al aceptar: por eso el conteo incluye
  // las invitaciones sin contestar.
  const cupo = puedeSumarAsiento(cobro.suscripcion, cobro.consumo)
  const libres = asientosLibres(cobro.suscripcion, cobro.consumo)

  return (
    <div className="flex flex-col gap-7">
      <div className="border-b border-[var(--color-regla-fuerte)] pb-4">
        <h1 className="text-portada">Equipo</h1>
        <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
          {sesion.activa.despachoNombre}
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-guia">
          Quién está dentro{' '}
          <span className="font-obra text-menor font-normal text-[var(--color-tinta-suave)]">
            {equipo.length}
          </span>
        </h2>

        <ul className="flex flex-col gap-px border-y border-[var(--color-regla)] bg-[var(--color-regla)]">
          {equipo.map((m) => {
            const dadoDeBaja = m.estado !== 'activa'
            const bloqueoBaja = puedeDarDeBaja(m, sesion.usuarioId)
            const bloqueoRol = puedeCambiarRol(m, 'abogado')
            const pendientesSuyos = carga.get(m.perfilId) ?? 0

            return (
              <li
                key={m.perfilId}
                className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-[var(--color-foja)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">
                    {m.nombre}
                    {m.perfilId === sesion.usuarioId ? (
                      <span className="ml-2 align-middle">
                        <Sello tono="neutro">tú</Sello>
                      </span>
                    ) : null}
                    {dadoDeBaja ? (
                      <span className="ml-2 align-middle">
                        <Sello tono="urgente">dado de baja</Sello>
                      </span>
                    ) : null}
                  </p>
                  <p className="text-nota text-[var(--color-tinta-suave)]">
                    {m.correo ?? 'sin correo'} · desde el {dia(m.desdeEl)}
                    {pendientesSuyos > 0
                      ? ` · ${pendientesSuyos} pendiente${pendientesSuyos === 1 ? '' : 's'} a su nombre`
                      : ''}
                  </p>
                  {/* Dar de baja a alguien con términos vivos los deja sin
                      quien los vea. El panel los va a marcar huérfanos, pero
                      esto tiene que saberse ANTES de oprimir el botón. */}
                  {dadoDeBaja && pendientesSuyos > 0 ? (
                    <p className="mt-1 text-nota text-[var(--color-urgente)]">
                      {pendientesSuyos} pendiente
                      {pendientesSuyos === 1 ? '' : 's'} sin quien los vea.
                      Reasígna
                      {pendientesSuyos === 1 ? 'lo' : 'los'} desde cada
                      expediente.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {esTitular && !bloqueoRol && !dadoDeBaja ? (
                    <form action={cambiarRol} className="flex items-center gap-2">
                      <input type="hidden" name="perfilId" value={m.perfilId} />
                      <label
                        htmlFor={`rol-${m.perfilId}`}
                        className="text-nota text-[var(--color-tinta-suave)]"
                      >
                        Papel
                      </label>
                      <select
                        id={`rol-${m.perfilId}`}
                        name="rol"
                        defaultValue={m.rol}
                        className="rounded-sm border border-[var(--color-regla)] bg-[var(--color-foja)] px-2 py-1 text-menor"
                      >
                        {ROLES_INVITABLES.map((r) => (
                          <option key={r} value={r}>
                            {ROL_MEMBRESIA_ETIQUETA[r]}
                          </option>
                        ))}
                      </select>
                      <Boton variante="fantasma" type="submit" className="px-0 py-0">
                        Cambiar
                      </Boton>
                    </form>
                  ) : (
                    <span className="text-menor">
                      {ROL_MEMBRESIA_ETIQUETA[m.rol]}
                    </span>
                  )}

                  {esTitular && dadoDeBaja ? (
                    <form action={reactivar}>
                      <input type="hidden" name="perfilId" value={m.perfilId} />
                      <Boton variante="secundario" type="submit">
                        Reactivar
                      </Boton>
                    </form>
                  ) : null}

                  {esTitular && !dadoDeBaja && !bloqueoBaja ? (
                    <form action={darDeBaja}>
                      <input type="hidden" name="perfilId" value={m.perfilId} />
                      <Boton variante="fantasma" type="submit" className="px-0 py-0">
                        Dar de baja
                      </Boton>
                    </form>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>

        <p className="mt-2 text-nota text-[var(--color-tinta-suave)]">
          Dar de baja quita el acceso a todo de inmediato, pero no borra a la
          persona: las actuaciones que firmó y los plazos que cerró siguen
          ligados a su nombre. La bitácora es lo único que no se puede
          reconstruir.
        </p>
      </section>

      {esTitular ? (
        <>
          <Foja className="flex flex-col gap-4">
            <div>
              <Rotulo>Invitar a alguien</Rotulo>
              <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
                Quien acepte va a ver los expedientes del despacho, sus plazos y
                sus audiencias. {ROL_ALCANCE.abogado}
              </p>
              {cupo.permitido ? (
                <p className="mt-1 text-nota text-[var(--color-tinta-suave)]">
                  {libres === 1
                    ? 'Queda 1 asiento en tu plan.'
                    : `Quedan ${libres} asientos en tu plan.`}{' '}
                  Los clientes del portal no ocupan asiento.
                </p>
              ) : null}
            </div>

            {cupo.permitido ? null : (
              <Aviso tono="error">
                {cupo.motivo} {cupo.salida}{' '}
                <Link href="/panel/suscripcion" className="underline">
                  Ver la suscripción
                </Link>
                .
              </Aviso>
            )}

            <FormularioInvitar />
          </Foja>

          {pendientes.length > 0 ? (
            <section>
              <h2 className="mb-2 text-guia">
                Invitaciones abiertas{' '}
                <span className="font-obra text-menor font-normal text-[var(--color-tinta-suave)]">
                  {pendientes.length}
                </span>
              </h2>
              <ul className="flex flex-col gap-px border-y border-[var(--color-regla)] bg-[var(--color-regla)]">
                {pendientes.map((i) => {
                  const vigente = estaVigente({
                    estado: i.estado,
                    expiraEl: i.expiraEl,
                  })
                  return (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 bg-[var(--color-foja)] px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{i.correo}</p>
                        <p className="text-nota text-[var(--color-tinta-suave)]">
                          {ROL_MEMBRESIA_ETIQUETA[i.rol]} ·{' '}
                          {vigente
                            ? `caduca el ${dia(i.expiraEl)}`
                            : `caducó el ${dia(i.expiraEl)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {vigente ? null : <Sello tono="urgente">caducada</Sello>}
                        <form action={revocarInvitacion}>
                          <input type="hidden" name="invitacionId" value={i.id} />
                          <Boton
                            variante="fantasma"
                            type="submit"
                            className="px-0 py-0"
                          >
                            Revocar
                          </Boton>
                        </form>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}
        </>
      ) : (
        <Aviso tono="informativo">
          Solo el titular del despacho invita y da de baja. Un papel que pudiera
          repartir accesos convertiría a cualquiera en administrador del
          despacho sin que el dueño se entere.
        </Aviso>
      )}
    </div>
  )
}

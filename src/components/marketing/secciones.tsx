import Link from 'next/link'

import { Boton, CintaDias, Sello } from '@/components/ui/primitivos'
import { MONEDA, NO_HACE, PLANES, precioLegible } from '@/lib/marketing/planes'
import { tramoDeDias } from '@/lib/plazos/calendario'
import { CALENDARIO_PJF_2026 } from '@/lib/plazos/calendarios-semilla'
import { computarPlazo } from '@/lib/plazos/computo'

/**
 * Las secciones de la portada.
 *
 * ⚠️ **Todo lo que se enseña sale del motor de verdad**, no de texto escrito a
 * mano: la cinta del encabezado, la traza del cómputo y las fechas de la agenda
 * los produce el mismo código que corre dentro del panel. Si mañana se corrige
 * un calendario o una regla de surtimiento, la portada se corrige sola.
 *
 * No es purismo: una portada que promete un cómputo y enseña un dibujo del
 * cómputo es una portada que puede mentir sin que nadie se entere, justo en el
 * producto cuyo argumento entero es "no finge certeza".
 */

// ── El caso que se enseña, computado de verdad ──────────────────────────────
const ETIQUETA_DEMO = 'Contestación de demanda — juicio ordinario mercantil'

const DEMO = computarPlazo({
  regimen: 'mercantil',
  tipoNotificacion: 'lista',
  fechaNotificacion: '2026-03-09',
  dias: 15,
  unidad: 'habiles',
  calendario: CALENDARIO_PJF_2026,
  etiqueta: ETIQUETA_DEMO,
  fundamentoPlazo: 'Código de Comercio, art. 1378',
})

function Seccion({
  titulo,
  children,
  id,
}: {
  titulo: string
  children: React.ReactNode
  id?: string
}) {
  return (
    <section id={id} className="border-t border-[var(--color-regla-fuerte)] pt-10">
      <h2 className="text-rotulo">{titulo}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export function ElProblema() {
  return (
    <Seccion titulo="Un término no se recupera">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="max-w-prose">
          <p>
            Una tarea que se te pasa se hace tarde. Un término que se te pasa
            precluye: se pierde el derecho, y con él el asunto, el cliente y a
            veces la cédula.
          </p>
          <p className="mt-3 text-[var(--color-tinta-suave)]">
            El error casi nunca es olvidar la fecha. Es contarla mal —desde el
            día equivocado, o en días naturales— y descubrirlo cuando ya pasó.
          </p>
        </div>

        <ul className="flex flex-col gap-4 text-menor">
          <li className="border-l-2 border-[var(--color-urgente)] pl-4">
            <p className="font-medium">El doble salto</p>
            <p className="text-[var(--color-tinta-suave)]">
              Notificado el lunes por lista, en mercantil el plazo corre desde
              el miércoles. Quien cuenta desde el lunes presenta fuera de
              término creyendo que le sobraban dos días.
            </p>
          </li>
          <li className="border-l-2 border-[var(--color-urgente)] pl-4">
            <p className="font-medium">Las vacaciones del órgano</p>
            <p className="text-[var(--color-tinta-suave)]">
              Entre el 15 de julio y el 3 de agosto hay veinte días naturales y
              dos hábiles. Una agenda que cuenta en naturales avisa tarde justo
              cuando más se confía uno.
            </p>
          </li>
          <li className="border-l-2 border-[var(--color-urgente)] pl-4">
            <p className="font-medium">El calendario equivocado</p>
            <p className="text-[var(--color-tinta-suave)]">
              El federal descansa en fechas distintas al laboral. Un despacho
              con las dos materias que use un solo calendario se equivoca en la
              mitad de sus asuntos.
            </p>
          </li>
        </ul>
      </div>
    </Seccion>
  )
}

export function LaTraza() {
  const cinta = tramoDeDias(
    DEMO.fechaNotificacion,
    DEMO.fechaVencimiento,
    CALENDARIO_PJF_2026,
  )
  const habiles = cinta.filter((d) => d.habil).length

  return (
    <Seccion titulo="El cómputo se enseña, no se entrega">
      <p className="max-w-prose">
        Litis no te da una fecha: te da el razonamiento. Un abogado no puede
        firmar una promoción confiando en algo que le escupió una caja negra,
        porque quien responde ante el cliente y ante la barra es él.
      </p>

      <div className="mt-6 border border-[var(--color-regla)] bg-[var(--color-foja)] p-5">
        <p className="text-menor text-[var(--color-tinta-suave)]">
          {ETIQUETA_DEMO}
        </p>
        <p className="mt-1 text-rotulo">
          Vence el{' '}
          {new Date(`${DEMO.fechaVencimiento}T00:00:00Z`).toLocaleDateString(
            'es-MX',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' },
          )}
        </p>

        <div className="mt-4">
          <CintaDias
            dias={cinta}
            descripcion={`${cinta.length} días naturales, ${habiles} hábiles.`}
          />
        </div>

        <ol className="mt-5 flex flex-col gap-3 border-t border-[var(--color-regla)] pt-4">
          {DEMO.pasos.map((paso) => (
            <li key={paso.orden} className="flex gap-4 text-menor">
              <span className="w-4 shrink-0 text-[var(--color-tinta-suave)]">
                {paso.orden}
              </span>
              <div>
                <p className="font-medium">{paso.titulo}</p>
                <p className="text-[var(--color-tinta-suave)]">{paso.detalle}</p>
                {paso.fundamento ? (
                  <p className="text-nota text-[var(--color-sello)]">
                    {paso.fundamento}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 border-t border-[var(--color-regla)] pt-3 text-nota text-[var(--color-tinta-suave)]">
          Este cómputo lo produjo el mismo motor que corre dentro del panel, con
          el calendario del Poder Judicial de la Federación. No es una captura
          de pantalla.
        </p>
      </div>
    </Seccion>
  )
}

const CAPACIDADES: readonly { titulo: string; texto: string }[] = [
  {
    titulo: 'Avisa aunque nadie abra nada',
    texto:
      'Una corrida diaria manda un correo por persona con sus términos ordenados por urgencia. Si no puede leer el registro de lo ya enviado, se detiene y avisa: es preferible no avisar hoy que reenviarle el mismo aviso a todos hasta quemar el correo del despacho.',
  },
  {
    titulo: 'Audiencias y vencimientos en el mismo calendario',
    texto:
      'Compiten por el mismo día, así que van en la misma lista. Un día con audiencia queda marcado como tomado: se lleva la jornada entre traslado, espera y desahogo.',
  },
  {
    titulo: 'Cruza el conflicto de interés',
    texto:
      'Al abrir un asunto y al agregar una parte a media causa, contra todo tu padrón de clientes y contrapartes. Te enseña las coincidencias con su evidencia y deja constancia de quién las revisó. No decide por ti.',
  },
  {
    titulo: 'Una bitácora que no se reescribe',
    texto:
      'Lo que se asienta se queda; corregir es agregar otra actuación que rectifique. Y una promoción presentada fuera de plazo queda asentada con esas palabras: un sistema que ayuda a maquillar eso es peor que no tener sistema.',
  },
]

export function QueHace() {
  return (
    <Seccion titulo="Qué hace">
      <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
        {CAPACIDADES.map((c) => (
          <div key={c.titulo} className="border-l-2 border-[var(--color-sello)] pl-4">
            <h3 className="text-guia">{c.titulo}</h3>
            <p className="mt-1 max-w-prose text-menor text-[var(--color-tinta-suave)]">
              {c.texto}
            </p>
          </div>
        ))}
      </div>
    </Seccion>
  )
}

export function NoFingeCerteza() {
  return (
    <Seccion titulo="Lo que no hace">
      <p className="max-w-prose text-[var(--color-tinta-suave)]">
        Decirlo aquí cuesta algunos registros y ahorra todas las bajas. Quien lo
        descubre en la semana tres se siente engañado, y con razón.
      </p>
      <ul className="mt-5 flex flex-col gap-4">
        {NO_HACE.map((n) => (
          <li key={n.que} className="max-w-prose border-l-2 border-[var(--color-regla-fuerte)] pl-4">
            <p className="font-medium">{n.que}</p>
            <p className="text-menor text-[var(--color-tinta-suave)]">{n.porque}</p>
          </li>
        ))}
      </ul>

      <p className="mt-6 max-w-prose border-t border-[var(--color-regla)] pt-4 text-menor text-[var(--color-tinta-suave)]">
        Y el catálogo de plazos se entrega marcado como <strong>no
        verificado</strong>, y así se muestra hasta que un abogado del despacho
        lo confirme y quede la constancia. Los ordenamientos se reforman: el
        Código Nacional de Procedimientos Civiles y Familiares está desplazando
        a los códigos locales hasta 2027. Un catálogo estático miente.
      </p>
    </Seccion>
  )
}

export function Precios() {
  return (
    <Seccion titulo="Precios" id="precios">
      <p className="max-w-prose text-[var(--color-tinta-suave)]">
        Por usuario al mes, en pesos. Sin contrato anual y sin cobro por
        expediente: una herramienta que te cobra por abrir un asunto es una
        herramienta que te empuja a no capturarlo.
      </p>

      <div className="mt-6 grid gap-px bg-[var(--color-regla)] md:grid-cols-2">
        {PLANES.map((plan) => (
          <div
            key={plan.clave}
            className="flex flex-col gap-4 bg-[var(--color-foja)] p-6"
          >
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h3 className="text-guia">{plan.nombre}</h3>
                {plan.destacado ? <Sello>lo que usa un despacho</Sello> : null}
              </div>
              <p className="mt-1 text-menor text-[var(--color-tinta-suave)]">
                {plan.promesa}
              </p>
            </div>

            <p className="text-portada">
              {precioLegible(plan)}
              {plan.precio > 0 ? (
                <span className="font-obra text-menor font-normal text-[var(--color-tinta-suave)]">
                  {' '}
                  {MONEDA} por usuario al mes
                </span>
              ) : null}
            </p>

            <ul className="flex flex-col gap-1.5 text-menor">
              {plan.incluye.map((linea) => (
                <li key={linea} className="border-l-2 border-[var(--color-regla)] pl-3">
                  {linea}
                </li>
              ))}
            </ul>

            {plan.tope ? (
              <p className="text-nota text-[var(--color-tinta-suave)]">{plan.tope}</p>
            ) : null}

            <div className="mt-auto pt-2">
              <Link href="/registro">
                <Boton variante={plan.destacado ? 'primario' : 'secundario'}>
                  {plan.precio === 0 ? 'Empezar gratis' : 'Crear despacho'}
                </Boton>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* La honestidad que el resto del producto ya practica, aplicada al
          precio. */}
      <p className="mt-5 max-w-prose text-nota text-[var(--color-tinta-suave)]">
        Todavía no hay un despacho pagando, así que este precio es una hipótesis
        y no una medición. Si resulta que está mal puesto, se corrige — y quien
        ya esté dentro conserva el suyo.
      </p>
    </Seccion>
  )
}

export function Cierre() {
  return (
    <section className="border-t border-[var(--color-regla-fuerte)] pt-10">
      <h2 className="max-w-prose text-rotulo">
        Empieza con un asunto. El que más te preocupe.
      </h2>
      <p className="mt-3 max-w-prose text-[var(--color-tinta-suave)]">
        Captura su notificación y mira el cómputo con su fundamento a la vista.
        Si la fecha coincide con la que traías en la cabeza, ya sabes que
        funciona. Si no coincide, acabas de encontrar algo.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/registro">
          <Boton>Crear despacho</Boton>
        </Link>
        <Link href="/acceso">
          <Boton variante="secundario">Ya tengo cuenta</Boton>
        </Link>
      </div>
    </section>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'

import { Clausula, Documento, Puntos } from '@/components/legal/marco'
import { AVISO_COMPUTO, MARCA, titulo } from '@/lib/brand'
import { RESPONSABLE, frenteAlIva, nombreDelResponsable } from '@/lib/legal/responsable'
import { MONEDA, PLANES } from '@/lib/marketing/planes'
import { TOPES_POR_PLAN } from '@/lib/suscripcion/limites'

export const metadata: Metadata = {
  title: titulo('Términos y condiciones'),
  description: `Las condiciones de uso de ${MARCA.nombre}: qué es, qué no es, cómo se cobra y quién responde de qué.`,
}

const PLAN_DE_PAGA = PLANES.find((p) => p.clave === 'despacho')

/**
 * Los términos de uso.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA CLÁUSULA QUE IMPORTA ES LA 9
 * ─────────────────────────────────────────────────────────────────────────────
 * Un producto que computa plazos y deja creer que la fecha es definitiva le
 * está pasando al abogado un riesgo que este no aceptó. Por eso lo que aquí se
 * dice sobre la responsabilidad del término es **el mismo texto** que aparece
 * junto a cada cómputo en pantalla (`AVISO_COMPUTO`, en `lib/brand`): no una
 * versión suavizada para la venta y otra dura para la letra chica. Se importa
 * de ahí a propósito, para que no puedan separarse.
 *
 * Los topes del plan gratuito y el precio también se importan del código que de
 * verdad los aplica. Un contrato que promete diez expedientes mientras el
 * sistema corta en ocho es una promesa incumplida por escrito.
 */
export default function PaginaTerminos() {
  const responsable = nombreDelResponsable()
  const iva = frenteAlIva()
  const topeGratis = TOPES_POR_PLAN.gratuito

  return (
    <Documento
      titulo="Términos y condiciones"
      entrada={`Las condiciones de uso de ${MARCA.nombre}: qué es, qué no es, cómo se cobra y quién responde de qué.`}
    >
      <Clausula numero={1} titulo="Qué es Litis, y qué no es">
        <p>
          {MARCA.nombre} es una herramienta de control interno para despachos de
          litigio: organiza expedientes, calcula plazos procesales con su
          fundamento a la vista, agenda audiencias y avisa antes de que algo
          venza.
        </p>
        <p className="border-l-2 border-[var(--color-urgente)] pl-4">
          {AVISO_COMPUTO}
        </p>
        <p>
          Dicho de otro modo: {MARCA.nombre} no presta servicios legales, no
          sustituye el criterio de un abogado y no emite dictámenes. Lo que
          calcula es una propuesta que el profesional verifica.
        </p>
      </Clausula>

      <Clausula numero={2} titulo="Quién puede usarlo y qué implica la cuenta">
        <p>
          Para crear un despacho hay que ser mayor de edad y usar el servicio en
          el ejercicio de una actividad profesional. Los datos que se registren
          deben ser verdaderos, y quien crea el despacho —el titular— es quien
          administra el equipo, contrata la suscripción y responde por lo que
          hagan las personas a las que dé acceso.
        </p>
        <p>
          Las credenciales son personales. Compartir una cuenta entre varias
          personas rompe lo único que hace verificable la bitácora: que cada
          movimiento tenga nombre. Si sospechas que alguien más entró a tu
          cuenta, cambia la contraseña y avísanos.
        </p>
      </Clausula>

      <Clausula numero={3} titulo="Planes, precio y cobro">
        <Puntos
          items={[
            `Plan gratuito: ${topeGratis.asientos === 1 ? 'un asiento' : `${topeGratis.asientos} asientos`} y hasta ${topeGratis.expedientesActivos} expedientes activos. No caduca y no pide tarjeta.`,
            `Plan de paga: expedientes sin tope y ${PLAN_DE_PAGA ? `$${PLAN_DE_PAGA.precio.toLocaleString('es-MX')} ${MONEDA}` : 'una cuota'} por asiento al mes. Un asiento es una persona del despacho; los clientes que entran al portal a consultar su asunto no ocupan asiento.`,
            'El cobro corre por Stripe. Los datos de la tarjeta se capturan allá y nunca pasan por los servidores de Litis.',
            'La suscripción se renueva sola cada mes hasta que se cancele, y se cancela desde el portal de facturación, sin trámite ni llamada.',
          ]}
        />
        {iva ? <p>{iva}</p> : null}
        <p>
          Al cancelar, la suscripción sigue vigente hasta el final del periodo ya
          pagado. Los cambios de cantidad de asientos a media suscripción se
          prorratean.
        </p>
      </Clausula>

      <Clausula numero={4} titulo="Qué pasa si dejas de pagar, o bajas de plan">
        <p>
          Esta cláusula está escrita como compromiso, no como advertencia. Un
          tope de plan solo puede impedir dos cosas:{' '}
          <strong>abrir un expediente nuevo</strong> y{' '}
          <strong>sumar a alguien al equipo</strong>.
        </p>
        <p>
          Todo lo demás sigue funcionando con la suscripción vencida, morosa o
          cancelada: cerrar un plazo, asentar en la bitácora, subir documentos,
          computar un vencimiento, recibir las alertas por correo y leer todo lo
          ya capturado. La razón es simple: un problema de facturación no puede
          convertirse en un término perdido, y del término responde el abogado
          ante su cliente.
        </p>
        <p>
          Por lo mismo, si al bajar de plan tu despacho queda por encima del tope,{' '}
          <strong>no se suspende a nadie ni se archiva nada</strong>. Conservas
          tus expedientes y tu equipo; lo que no puedes es abrir más hasta que
          vuelvas a tener cupo.
        </p>
      </Clausula>

      <Clausula numero={5} titulo="El contenido de tu despacho es tuyo">
        <p>
          Los expedientes, el padrón, la bitácora y los documentos que subas son
          y siguen siendo del despacho. {responsable} no adquiere derechos sobre
          ellos: los aloja y los procesa para prestarte el servicio, y para nada
          más.
        </p>
        <p>
          En particular, y porque conviene decirlo con todas sus letras:{' '}
          <strong>
            el contenido de los expedientes no se usa para entrenar modelos de
            inteligencia artificial
          </strong>
          , ni propios ni de terceros.
        </p>
        <p>
          El software, el diseño y el catálogo de plazos de {MARCA.nombre} son de{' '}
          {responsable}. Puedes usarlos para operar tu despacho; no para
          revenderlos, copiarlos ni ofrecerlos como servicio propio.
        </p>
      </Clausula>

      <Clausula numero={6} titulo="Confidencialidad y secreto profesional">
        <p>
          Lo que hay aquí adentro es información reservada de los clientes de un
          abogado. {responsable} se obliga a tratarla como confidencial y a no
          divulgarla.
        </p>
        <p>
          Nadie del equipo de {MARCA.nombre} consulta el contenido de un
          expediente salvo que sea indispensable para atender un problema técnico
          que hayas reportado, o que lo requiera una autoridad con facultades
          para pedirlo. Si eso pasa y la ley lo permite, se te avisa.
        </p>
      </Clausula>

      <Clausula numero={7} titulo="Uso aceptable">
        <Puntos
          items={[
            'No usar el servicio para actividades ilícitas ni para almacenar contenido que no tengas derecho a tratar.',
            'No intentar acceder a datos de otro despacho, ni sondear, vulnerar o sobrecargar el sistema.',
            'No revender el acceso ni compartir asientos con personas ajenas al despacho.',
            'No automatizar el uso del servicio de forma que degrade el funcionamiento para los demás.',
          ]}
        />
        <p>
          Un incumplimiento grave puede llevar a suspender la cuenta. Antes de
          hacerlo se avisa y se da oportunidad de corregir, salvo que la conducta
          ponga en riesgo los datos de alguien más.
        </p>
      </Clausula>

      <Clausula numero={8} titulo="Disponibilidad del servicio">
        <p>
          {MARCA.nombre} está en una etapa temprana y{' '}
          <strong>no ofrece todavía un compromiso de disponibilidad</strong>. Se
          dice porque es la verdad y porque cambia cómo conviene usarlo: el
          servicio puede tener interrupciones, ventanas de mantenimiento o
          errores.
        </p>
        <p>
          De ahí se sigue lo obvio, y vale la pena escribirlo: no dependas de un
          único sistema para un término que no puedes perder. Las alertas por
          correo son una red de apoyo, no la única.
        </p>
      </Clausula>

      <Clausula numero={9} titulo="De los plazos responde quien firma la promoción">
        <p>
          Es la cláusula más importante de este documento. Los cómputos de{' '}
          {MARCA.nombre} salen de un catálogo de plazos y de calendarios de días
          inhábiles que el propio sistema marca como{' '}
          <strong>no verificados</strong> mientras un abogado no los revise y los
          firme dentro de la herramienta.
        </p>
        <p>
          Un plazo mal capturado, un calendario desactualizado, una regla de
          cómputo que cambió o una notificación registrada con la fecha
          equivocada producen una fecha equivocada. Por eso cada cómputo se
          muestra con su traza completa: para que se pueda revisar, no para que
          se pueda confiar a ciegas.
        </p>
        <p>
          La verificación del término frente al ordenamiento aplicable y al
          calendario del órgano, y la decisión de cuándo presentar, son del
          abogado. {responsable} no responde por términos perdidos, resoluciones
          adversas ni consecuencias procesales derivadas del uso del servicio.
        </p>
      </Clausula>

      <Clausula numero={10} titulo="Límite de responsabilidad">
        <p>
          Fuera de los casos en que la ley no permite limitarla —dolo o mala fe,
          entre ellos—, la responsabilidad de {responsable} frente al despacho
          por cualquier reclamación relacionada con el servicio se limita al
          monto que ese despacho haya pagado por la suscripción en los tres meses
          anteriores al hecho que la origine.
        </p>
        <p>
          No se responde por daños indirectos, pérdida de clientes o lucro
          cesante.
        </p>
      </Clausula>

      <Clausula numero={11} titulo="Terminar la relación y llevarte tus datos">
        <p>
          Puedes dejar de usar {MARCA.nombre} cuando quieras: cancelas la
          suscripción y, si además quieres que se borre todo, lo pides y se
          borra.
        </p>
        <p>
          Con franqueza sobre el estado de las cosas:{' '}
          <strong>todavía no hay una función de exportación</strong> que te
          descargue el despacho completo con un botón. Mientras no exista, se
          entrega a solicitud, en formato legible por máquina y sin costo. Que
          los datos sean tuyos y que puedas sacarlos no es negociable, aunque hoy
          el camino sea manual.
        </p>
      </Clausula>

      <Clausula numero={12} titulo="Cambios a estos términos">
        <p>
          Si estos términos cambian, la fecha de arriba lo refleja y un cambio de
          fondo se avisa por correo al titular del despacho antes de que aplique.
          Seguir usando el servicio después de esa fecha significa aceptarlos; si
          no estás de acuerdo, puedes cancelar y pedir el borrado de tus datos.
        </p>
      </Clausula>

      <Clausula numero={13} titulo="Ley aplicable">
        <p>
          Estos términos se rigen por la legislación mexicana.
          {RESPONSABLE.jurisdiccion
            ? ` Para cualquier controversia, las partes se someten a los tribunales competentes de ${RESPONSABLE.jurisdiccion}, renunciando a cualquier otro fuero que pudiera corresponderles.`
            : ' La ciudad cuyos tribunales serían competentes está pendiente de definir.'}
        </p>
        <p>
          Cómo se tratan los datos personales se explica en el{' '}
          <Link
            href="/aviso-de-privacidad"
            className="underline underline-offset-4"
          >
            aviso de privacidad
          </Link>
          , que forma parte de estos términos.
        </p>
      </Clausula>
    </Documento>
  )
}

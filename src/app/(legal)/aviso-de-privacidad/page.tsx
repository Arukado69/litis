import type { Metadata } from 'next'

import { Clausula, Documento, Puntos } from '@/components/legal/marco'
import { MARCA, titulo } from '@/lib/brand'
import { RESPONSABLE, nombreDelResponsable } from '@/lib/legal/responsable'
import {
  DATOS_QUE_SE_TRATAN,
  ENCARGADOS,
  LO_QUE_NO_SE_HACE,
} from '@/lib/legal/tratamiento'

export const metadata: Metadata = {
  title: titulo('Aviso de privacidad'),
  description: `Qué datos personales trata ${MARCA.nombre}, para qué, quién más los procesa y cómo se ejercen los derechos ARCO.`,
}

/**
 * El aviso de privacidad.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LA PARTE QUE NO SE PARECE A LA DE CUALQUIER SAAS
 * ─────────────────────────────────────────────────────────────────────────────
 * Aquí no se guardan «datos de usuarios»: se guardan los expedientes de los
 * clientes de un abogado, que están cubiertos por el secreto profesional. Eso
 * cambia quién responde por qué, y por eso hay una cláusula entera dedicada a
 * decir que **del padrón y de los expedientes responde el despacho**, y que
 * Litis solo los procesa por cuenta suya.
 *
 * El inventario de datos y de encargados sale de `lib/legal/tratamiento.ts`, no
 * de párrafos escritos aquí: cuando una migración agregue una columna con datos
 * de una persona, este documento se actualiza con ella. Un aviso que describe
 * un sistema que ya cambió afirma cosas falsas con cara de documento formal.
 */
export default function PaginaAvisoDePrivacidad() {
  const responsable = nombreDelResponsable()

  return (
    <Documento
      titulo="Aviso de privacidad"
      entrada={`Qué datos personales trata ${MARCA.nombre}, para qué, quién más los procesa y cómo se ejercen los derechos de acceso, rectificación, cancelación y oposición.`}
    >
      <Clausula numero={1} titulo="Quién responde por tus datos">
        {/* Sin razón social no se escribe una frase que suene completa: decir
            «el responsable es el responsable» disfraza un hueco de contenido.
            Mejor nombrar el hueco. */}
        {RESPONSABLE.razonSocial ? (
          <p>
            {RESPONSABLE.razonSocial} es el responsable del tratamiento de los
            datos personales que se recaban a través de {MARCA.nombre}, en
            términos de la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares y su Reglamento.
          </p>
        ) : (
          <p>
            Todavía no se publica quién es el responsable del tratamiento de los
            datos que se recaban a través de {MARCA.nombre}. Es el primer dato
            que exige la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares, y mientras falte, este aviso no puede
            tomarse como vigente.
          </p>
        )}
        {RESPONSABLE.domicilio ? (
          <p>Domicilio: {RESPONSABLE.domicilio}.</p>
        ) : null}
        {RESPONSABLE.correoPrivacidad ? (
          <p>
            Correo para asuntos de privacidad:{' '}
            <a
              href={`mailto:${RESPONSABLE.correoPrivacidad}`}
              className="underline underline-offset-4"
            >
              {RESPONSABLE.correoPrivacidad}
            </a>
            .
          </p>
        ) : null}
      </Clausula>

      <Clausula numero={2} titulo="Qué datos se tratan">
        <p>
          Esta es la lista completa, tomada del propio esquema de la base de
          datos. La última columna dice en qué tabla vive cada grupo, para que
          se pueda cotejar contra el sistema y no haya que creerlo de palabra.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-nota">
            <thead>
              <tr className="border-b border-[var(--color-regla-fuerte)] text-left">
                <th className="py-2 pr-4 font-medium">De quién</th>
                <th className="py-2 pr-4 font-medium">Qué datos</th>
                <th className="py-2 pr-4 font-medium">Para qué</th>
                <th className="py-2 font-medium">Dónde vive</th>
              </tr>
            </thead>
            <tbody>
              {DATOS_QUE_SE_TRATAN.map((g) => (
                <tr
                  key={g.quien}
                  className="border-b border-[var(--color-regla)] align-top"
                >
                  <td className="py-2 pr-4 font-medium">{g.quien}</td>
                  <td className="py-2 pr-4">{g.datos}</td>
                  <td className="py-2 pr-4">{g.paraQue}</td>
                  <td className="py-2 font-obra text-[var(--color-tinta-suave)]">
                    {g.donde}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          No se piden datos sensibles —salud, origen étnico, creencias— para
          operar la cuenta. Ahora bien, un expediente puede contener datos
          sensibles de las partes: quien decide qué se sube al expediente es el
          despacho, y es quien responde por ello.
        </p>
      </Clausula>

      <Clausula
        numero={3}
        titulo="Los datos de los clientes del despacho: quién responde por ellos"
      >
        <p>
          Es la distinción más importante de este aviso. Hay dos tipos de datos
          en el sistema y no tienen el mismo dueño:
        </p>
        <Puntos
          items={[
            `Los de la cuenta —nombre, correo, teléfono y cédula de quien usa ${MARCA.nombre}—, de los que responde ${responsable}.`,
            'Los del padrón y los expedientes —clientes, contrapartes, terceros y todo lo que se capture de un asunto—, de los que responde el despacho que los captura. Ese despacho es el responsable frente a esas personas y quien debe darles su propio aviso de privacidad.',
          ]}
        />
        <p>
          Sobre los segundos, {MARCA.nombre} actúa como <strong>encargado</strong>:
          los procesa por cuenta del despacho, siguiendo sus instrucciones, sin
          usarlos para nada propio y sin decidir sobre ellos. La relación de
          abogado y cliente está cubierta por el secreto profesional, y el
          sistema está construido para respetarlo: cada despacho solo puede leer
          lo suyo, y eso lo aplica la propia base de datos.
        </p>
      </Clausula>

      <Clausula numero={4} titulo="Para qué se usan">
        <p>Para operar el servicio, y nada más. En concreto:</p>
        <Puntos
          items={[
            'Dar acceso a la cuenta y saber quién hizo cada movimiento.',
            'Computar plazos procesales y avisar por correo antes de que venzan.',
            'Llevar los expedientes, la bitácora, las audiencias y los documentos del despacho.',
            'Cotejar conflicto de interés contra el padrón del propio despacho.',
            'Cobrar la suscripción y emitir los comprobantes que correspondan.',
            'Contestar dudas y avisar de cambios en el servicio.',
          ]}
        />
        <p>
          No hay finalidades secundarias. Si algún día se quisiera usar algún
          dato para algo distinto de lo anterior, se pediría el consentimiento
          por separado y se podría negar sin perder el servicio.
        </p>
      </Clausula>

      <Clausula numero={5} titulo="Quién más los procesa">
        <p>
          {MARCA.nombre} se apoya en proveedores para funcionar. Son{' '}
          <strong>encargados</strong>: procesan por cuenta de {responsable}, no
          pueden usar los datos para lo suyo, y su intervención no constituye una
          transferencia que requiera tu consentimiento. Se listan con nombre
          porque «podemos compartir datos con proveedores» no informa de nada.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-nota">
            <thead>
              <tr className="border-b border-[var(--color-regla-fuerte)] text-left">
                <th className="py-2 pr-4 font-medium">Proveedor</th>
                <th className="py-2 pr-4 font-medium">Para qué</th>
                <th className="py-2 font-medium">Dónde procesa</th>
              </tr>
            </thead>
            <tbody>
              {ENCARGADOS.map((e) => (
                <tr
                  key={e.nombre}
                  className="border-b border-[var(--color-regla)] align-top"
                >
                  <td className="py-2 pr-4 font-medium">{e.nombre}</td>
                  <td className="py-2 pr-4">{e.paraQue}</td>
                  <td className="py-2">{e.donde}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p>
          Los tres procesan fuera de México, así que los datos salen del país.
          Se dice aquí porque es información que cambia la decisión de un
          despacho que maneja información reservada de sus clientes.
        </p>
        <p>
          Fuera de esos encargados, los datos solo se entregarían a una
          autoridad que los requiera por escrito y con facultades para pedirlos.
          Si eso llegara a pasar y la ley lo permite, se le avisaría al despacho
          afectado.
        </p>
      </Clausula>

      <Clausula numero={6} titulo="Lo que no se hace">
        <Puntos items={LO_QUE_NO_SE_HACE} />
      </Clausula>

      <Clausula numero={7} titulo="Cómo se protegen">
        <Puntos
          items={[
            'Cada despacho solo puede leer y escribir lo suyo, y eso lo aplica la base de datos con seguridad a nivel de renglón, no la pantalla. Aunque una pantalla fallara, la base no entrega datos ajenos.',
            'Los documentos que sube el despacho viven en un almacén privado. No tienen dirección pública: se descargan con un enlace firmado que caduca en un minuto y que se genera con la sesión de quien lo pide.',
            'Las contraseñas no se guardan en el sistema: las administra el proveedor de autenticación. Los tokens de invitación se guardan como huella criptográfica, nunca en claro.',
            'Todo el tráfico viaja cifrado.',
            'Dar de baja a alguien del equipo le quita el acceso de inmediato, pero no borra lo que firmó en la bitácora: el historial de un expediente tiene que seguir siendo verificable.',
          ]}
        />
        <p>
          Ninguna medida de seguridad es absoluta. Si ocurriera una vulneración
          que afecte de forma significativa los datos, se avisaría a los
          despachos afectados con lo que se sepa y con lo que convenga hacer.
        </p>
      </Clausula>

      <Clausula numero={8} titulo="Cuánto se conservan y qué pasa al cancelar">
        <p>
          Los datos se conservan mientras la cuenta exista. Cancelar la
          suscripción <strong>no borra nada</strong>: el despacho baja al plan
          gratuito y conserva sus expedientes, precisamente para que nadie pierda
          el acceso a un asunto vivo por un problema de facturación.
        </p>
        <p>
          Para que se borre hay que pedirlo. Y conviene saber cómo funciona: la
          bitácora de un expediente es inmutable —no se edita ni se borran
          renglones sueltos, porque un historial que se puede alterar no sirve
          como historial—, así que una solicitud de borrado se atiende
          eliminando el expediente completo o la cuenta entera, no anotaciones
          individuales.
        </p>
        <p>
          Puede haber datos que la ley obligue a conservar por un tiempo, como
          los comprobantes de los pagos. Esos se conservan solo el plazo que
          corresponda y para esa finalidad.
        </p>
      </Clausula>

      <Clausula numero={9} titulo="Derechos ARCO y cómo ejercerlos">
        <p>
          Tienes derecho a <strong>acceder</strong> a tus datos personales, a{' '}
          <strong>rectificarlos</strong> si son inexactos, a{' '}
          <strong>cancelarlos</strong> cuando consideres que no se necesitan y a{' '}
          <strong>oponerte</strong> a un uso específico. También puedes revocar
          el consentimiento que hayas dado.
        </p>
        {RESPONSABLE.correoPrivacidad ? (
          <p>
            La solicitud se manda a{' '}
            <a
              href={`mailto:${RESPONSABLE.correoPrivacidad}`}
              className="underline underline-offset-4"
            >
              {RESPONSABLE.correoPrivacidad}
            </a>{' '}
            e incluye:
          </p>
        ) : (
          <p>
            La solicitud se manda al correo de privacidad del responsable
            —pendiente de publicar— e incluye:
          </p>
        )}
        <Puntos
          items={[
            'Tu nombre y un medio para contestarte.',
            'Un documento que acredite tu identidad, o la representación de quien pide por ti.',
            'Qué datos son y qué quieres que se haga con ellos.',
            'Cualquier cosa que ayude a localizarlos.',
          ]}
        />
        <p>
          Se contesta en un plazo de veinte días hábiles y, si procede, se
          ejecuta dentro de los quince días hábiles siguientes. Si la solicitud
          es sobre datos de un expediente, hay que decirlo desde el principio: de
          esos responde el despacho que los capturó y la solicitud se le turna a
          él, porque {MARCA.nombre} no puede decidir sobre información de la que
          no es responsable.
        </p>
        <p>
          Si la respuesta no te satisface, puedes acudir al Instituto Nacional de
          Transparencia, Acceso a la Información y Protección de Datos
          Personales.
        </p>
      </Clausula>

      <Clausula numero={10} titulo="Cookies">
        <p>
          El sitio usa únicamente las cookies de la sesión: son las que permiten
          seguir dentro de la cuenta al pasar de una pantalla a otra. Sin ellas
          no se puede usar el servicio. No hay cookies de publicidad, ni de
          analítica, ni de terceros.
        </p>
      </Clausula>

      <Clausula numero={11} titulo="Cambios a este aviso">
        <p>
          Si cambia lo que se hace con los datos, cambia este aviso, y la fecha
          de arriba lo refleja. Un cambio de fondo —una finalidad nueva, un
          encargado nuevo— se avisa además por correo a la cuenta del titular del
          despacho antes de que aplique. Nada de enterarse por casualidad al
          volver a leer la página.
        </p>
      </Clausula>
    </Documento>
  )
}

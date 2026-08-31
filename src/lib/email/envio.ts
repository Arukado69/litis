import 'server-only'

import { MARCA } from '@/lib/brand'

import { armarCorreo, type Correo, type CuerpoCorreo } from './plantilla'

/**
 * Envío de correo por Resend, con **degradación a simulación**.
 *
 * Sin `RESEND_API_KEY` el correo no sale: se escribe en la consola del servidor
 * y la función contesta `simulado`. No es un parche — es lo que permite
 * desarrollar y probar el flujo entero de invitaciones sin contratar nada, que
 * en la etapa en la que está este proyecto es la diferencia entre avanzar y
 * quedarse esperando una cuenta.
 *
 * ⚠️ **Nunca lanza.** Quien la llama está en medio de una operación que ya
 * escribió en la base: si el correo revienta, la invitación ya existe y lo
 * único que hay que hacer es decirle a quien invitó que copie el enlace a mano.
 * Tirar la Server Action ahí dejaría una invitación creada y una pantalla de
 * error, que es el peor de los dos mundos.
 */

export type ResultadoEnvio =
  | { estado: 'enviado' }
  | { estado: 'simulado' }
  | { estado: 'falló'; motivo: string }

const RESEND_URL = 'https://api.resend.com/emails'

function remitente(): string {
  // Resend exige un dominio verificado. Mientras no lo haya, el de pruebas
  // sirve para ver el correo real en la bandeja de la cuenta.
  return process.env.CORREO_REMITENTE?.trim() || 'Litis <onboarding@resend.dev>'
}

export async function enviarCorreo(
  para: string,
  correo: Correo,
): Promise<ResultadoEnvio> {
  const llave = process.env.RESEND_API_KEY?.trim()

  if (!llave) {
    console.info(
      `[correo simulado] para=${para} asunto=${correo.asunto}\n${correo.texto}`,
    )
    return { estado: 'simulado' }
  }

  try {
    const respuesta = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llave}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: remitente(),
        to: [para],
        subject: correo.asunto,
        html: correo.html,
        // Siempre las dos versiones: un correo solo-HTML puntúa peor en spam,
        // y este tiene que llegar.
        text: correo.texto,
      }),
    })

    if (!respuesta.ok) {
      return {
        estado: 'falló',
        motivo: `Resend contestó ${respuesta.status}.`,
      }
    }
    return { estado: 'enviado' }
  } catch (error) {
    return {
      estado: 'falló',
      motivo: error instanceof Error ? error.message : 'Error de red.',
    }
  }
}

/** Atajo: arma con la plantilla de la marca y manda. */
export async function enviarConPlantilla(
  para: string,
  cuerpo: CuerpoCorreo,
): Promise<ResultadoEnvio> {
  return enviarCorreo(para, armarCorreo(MARCA.nombre, cuerpo))
}

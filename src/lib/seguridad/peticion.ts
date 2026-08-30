import 'server-only'

import { headers } from 'next/headers'

/**
 * IP del cliente, para el freno anti-fuerza-bruta.
 *
 * ⚠️ `x-forwarded-for` lo pone el proxy de enfrente, y **quien manda la
 * petición puede inventárselo si no hay un proxy de confianza en medio**. En el
 * despliegue real (Nginx o la plataforma de hosting) el primer valor es el
 * cliente y es fiable; corriendo el servidor expuesto directo, no lo es.
 *
 * Se toma el PRIMER valor de la lista: los proxies van agregando al final, así
 * que el primero es el más cercano al cliente. Tomar el último daría siempre la
 * IP del propio proxy y el freno dejaría de distinguir a nadie.
 *
 * Cuando no hay encabezado se devuelve `desconocida`, que agrupa a todos esos
 * casos en un mismo cubo. Es lo correcto: prefiero frenar de más a que un
 * atacante se libre del límite simplemente quitando el encabezado.
 */
export async function ipDeLaPeticion(): Promise<string> {
  const h = await headers()

  const reenviada = h.get('x-forwarded-for')
  if (reenviada) {
    const primera = reenviada.split(',')[0]?.trim()
    if (primera) return primera
  }

  return h.get('x-real-ip')?.trim() || 'desconocida'
}

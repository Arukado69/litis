import { NextResponse, type NextRequest } from 'next/server'

import { correrAlertas } from '@/lib/alertas/corrida'
import { mismoSecreto } from '@/lib/seguridad/comparar'

/**
 * `GET /api/cron/alertas-plazos` — la corrida diaria de avisos.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIN `CRON_SECRET` CONTESTA 503, NO 200
 * ─────────────────────────────────────────────────────────────────────────────
 * Un endpoint abierto que manda correo es un cañón de spam apuntando a los
 * clientes del despacho, y además una forma barata de quemar la cuota del
 * proveedor. Si la variable no está configurada, esto **no corre**: falla
 * cerrado y lo dice, en vez de quedarse abierto en silencio.
 *
 * El secreto se compara en tiempo constante (`mismoSecreto`). Con `===`, el
 * tiempo que tarda delata cuántos caracteres iniciales acertó quien prueba, y
 * el secreto se reconstruye byte por byte en vez de adivinarse entero.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ES UN GET A PROPÓSITO
 * ─────────────────────────────────────────────────────────────────────────────
 * Lo llama el crontab del servidor con `curl`, y un GET con encabezado es lo
 * que cualquier cron sabe hacer sin envoltorios. No es idempotente en el
 * sentido estricto —manda correos—, pero el registro de envíos sí lo hace
 * seguro de repetir: dos llamadas el mismo día no mandan dos veces el mismo
 * aviso.
 */

/** Nunca se cachea: cada llamada tiene que consultar la base de verdad. */
export const dynamic = 'force-dynamic'

/**
 * Node, no edge: la corrida usa `node:crypto` y puede tardar más de lo que
 * aguanta el runtime de borde con muchos despachos.
 */
export const runtime = 'nodejs'

export async function GET(peticion: NextRequest) {
  const esperado = process.env.CRON_SECRET?.trim()

  if (!esperado) {
    return NextResponse.json(
      {
        ok: false,
        motivo:
          'Falta CRON_SECRET. El endpoint no corre sin él: abierto sería un cañón de spam apuntando a los clientes del despacho.',
      },
      { status: 503 },
    )
  }

  // Se acepta el encabezado estándar o `?clave=`, porque no todos los cron
  // saben mandar encabezados. La comparación es la misma para los dos.
  const enCabecera = peticion.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()
  const enUrl = peticion.nextUrl.searchParams.get('clave')?.trim()
  const recibido = enCabecera || enUrl || ''

  if (!mismoSecreto(recibido, esperado)) {
    // Sin detalle: un mensaje que distinga "falta" de "está mal" ayuda a quien
    // está probando claves.
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  // Cualquier excepción se convierte en un resumen. A este endpoint lo llama
  // un cron que nadie está mirando: un stack trace de 500 le dice al operador
  // que algo falló pero no qué, y el aviso que no salió no se entera nadie.
  try {
    const resumen = await correrAlertas()
    // Un fallo de la corrida contesta 500 para que el cron lo registre como
    // fallo y quede en la bitácora del servidor, no enterrado en un 200.
    return NextResponse.json(resumen, { status: resumen.ok ? 200 : 500 })
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Error desconocido.'
    console.error(`[alertas] la corrida reventó: ${motivo}`)
    return NextResponse.json({ ok: false, motivo }, { status: 500 })
  }
}

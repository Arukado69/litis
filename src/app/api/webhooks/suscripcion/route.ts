import { NextResponse, type NextRequest } from 'next/server'

import { aplicarEvento } from '@/lib/suscripcion/cobro'
import { interpretarEvento } from '@/lib/suscripcion/eventos'
import { verificarFirmaStripe } from '@/lib/suscripcion/firma'

/**
 * `POST /api/webhooks/suscripcion` — lo que Stripe manda cuando algo cambia.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIN `STRIPE_WEBHOOK_SECRET` CONTESTA 503, NO 200
 * ─────────────────────────────────────────────────────────────────────────────
 * Es el mismo criterio del cron de alertas: falla cerrado y lo dice. Este
 * endpoint escribe el plan con clave de servicio; sin firma que verificar,
 * cualquiera que descubra la URL manda un JSON diciendo que su despacho tiene
 * cincuenta asientos pagados. No hay versión "abierta pero inofensiva" de esto.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL CUERPO SE LEE CRUDO
 * ─────────────────────────────────────────────────────────────────────────────
 * `peticion.text()` y no `peticion.json()`: la firma se calcula sobre los bytes
 * exactos que mandó Stripe, y volver a serializar el objeto cambia espacios y
 * orden. Se verifica primero y se interpreta después, nunca al revés.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ SE CONTESTA, Y POR QUÉ IMPORTA
 * ─────────────────────────────────────────────────────────────────────────────
 * Stripe reintenta lo que no contesta 2xx. Así que un evento que no nos toca o
 * que no se puede aplicar por sí solo —no encontramos el despacho— contesta
 * 200: reintentarlo mil veces no lo va a arreglar, y queda guardado en
 * `suscripcion_eventos` con su aviso al operador para reconciliarlo a mano. El
 * 500 se reserva para lo que sí puede salir bien en el siguiente intento.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(peticion: NextRequest) {
  const secreto = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!secreto) {
    return NextResponse.json(
      {
        ok: false,
        motivo:
          'Falta STRIPE_WEBHOOK_SECRET. Sin firma que verificar, este endpoint escribiría el plan de quien se lo pida.',
      },
      { status: 503 },
    )
  }

  const cuerpo = await peticion.text()
  const firma = verificarFirmaStripe({
    cuerpo,
    encabezado: peticion.headers.get('stripe-signature'),
    secreto,
    ahora: Date.now(),
  })

  if (!firma.ok) {
    // Sin detalle en la respuesta: distinguir "sin firma" de "firma mala" le
    // sirve a quien está probando. El motivo sí va a la consola del servidor.
    console.warn(`[cobro] evento rechazado: ${firma.motivo}`)
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  let evento: unknown
  try {
    evento = JSON.parse(cuerpo)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const raiz = evento as { id?: unknown; type?: unknown; data?: unknown }
  const eventoId = typeof raiz.id === 'string' ? raiz.id : null
  const tipo = typeof raiz.type === 'string' ? raiz.type : null

  if (!eventoId || !tipo) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    const resultado = await aplicarEvento(
      eventoId,
      tipo,
      interpretarEvento(evento),
      raiz.data,
    )

    return NextResponse.json(
      { ok: resultado.estado !== 'falló', ...resultado },
      { status: resultado.estado === 'falló' ? 500 : 200 },
    )
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Error desconocido.'
    console.error(`[cobro] el webhook reventó: ${motivo}`)
    return NextResponse.json({ ok: false, motivo }, { status: 500 })
  }
}

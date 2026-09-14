import { NextResponse } from 'next/server'

import { exigirPanel } from '@/lib/auth/sesion'
import { leerDespachoCompleto } from '@/lib/despachos/exportacion-datos'
import {
  PORQUE_SOLO_TITULAR,
  armarExportacion,
  nombreDelArchivo,
  puedeExportar,
} from '@/lib/despachos/exportacion'

/**
 * `GET /api/despacho/exportar` — el despacho completo en un JSON.
 *
 * Los términos de uso (cláusula 11) prometen que los datos son del despacho y
 * que se entregan en formato legible por máquina y sin costo. Esto es esa
 * promesa, con un botón en vez de un correo.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UN ENLACE, NO UN FORMULARIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Igual que la descarga de documentos: la CSP lleva `form-action 'self'` y los
 * navegadores no coinciden en si eso alcanza a lo que sigue al envío. Una
 * navegación normal no toca esa directiva.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SOLO EL TITULAR
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️ No es celo de permisos: es lo que hace que el archivo esté COMPLETO. La
 * lectura corre con la sesión de quien pide —nunca con clave de servicio— y
 * `puede_ver_expediente` (migración `0003`) solo le da al titular los
 * expedientes restringidos que no son suyos. Con la sesión de un abogado el
 * archivo saldría sin esos y sin decirlo.
 *
 * Dicho con todas sus letras: **el corte es de la aplicación, no de la RLS.**
 * Un abogado que llame esta ruta no obtendría datos ajenos —la RLS no se lo
 * permitiría—, obtendría un subconjunto de lo suyo. Se le niega para que nadie
 * se lleve un archivo incompleto creyendo que se llevó el despacho.
 *
 * ⚠️ **El tope del plan no frena esto** (regla 17). El día que un despacho se
 * quiere ir es justo cuando su suscripción está cancelada o morosa; un cobro
 * que impide sacar los datos propios convierte un problema de tarjeta en un
 * secuestro.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const sesion = await exigirPanel()

  if (!puedeExportar(sesion.activa.rol)) {
    return NextResponse.json({ error: PORQUE_SOLO_TITULAR }, { status: 403 })
  }

  const generadaEl = new Date().toISOString()

  let filas
  try {
    filas = await leerDespachoCompleto(sesion.activa.despachoId)
  } catch (error) {
    // Se registra el detalle en el servidor y se contesta corto: el mensaje de
    // Postgres puede nombrar columnas y políticas, y esta ruta la puede llamar
    // cualquiera con sesión.
    console.error('[exportar] falló la lectura', error)
    return NextResponse.json(
      {
        error:
          'No se pudo armar la exportación. No se descargó nada: un archivo a medias con cara de completo es peor que ninguno. Inténtalo otra vez y, si sigue fallando, avísanos.',
      },
      { status: 502 },
    )
  }

  const exportacion = armarExportacion({
    despacho: {
      id: sesion.activa.despachoId,
      nombre: sesion.activa.despachoNombre,
      slug: sesion.activa.despachoSlug,
    },
    generadaPor: {
      perfil_id: sesion.usuarioId,
      nombre: sesion.nombre,
      correo: sesion.correo,
    },
    generadaEl,
    filas,
  })

  const archivo = nombreDelArchivo(sesion.activa.despachoSlug, generadaEl)

  return new NextResponse(JSON.stringify(exportacion, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="${archivo}"`,
      // Es el despacho entero: ni el navegador ni un intermediario tienen por
      // qué guardárselo.
      'cache-control': 'no-store, max-age=0',
    },
  })
}

import { NextResponse } from 'next/server'

import { exigirPanel } from '@/lib/auth/sesion'
import { clienteServidor } from '@/lib/supabase/server'

/**
 * `GET /api/documentos/{id}` — redirige a un enlace de descarga firmado.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ UN ENLACE Y NO UN FORMULARIO
 * ─────────────────────────────────────────────────────────────────────────────
 * La descarga se resolvía con un `<form>` que la Server Action redirigía. La
 * CSP de este proyecto lleva `form-action 'self'`, y los navegadores no se
 * ponen de acuerdo en si esa directiva alcanza a la redirección que sigue al
 * envío. Un botón de descarga que unos navegadores bloquean en silencio es peor
 * que uno feo. Una navegación normal no toca `form-action`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL BUCKET ES PRIVADO
 * ─────────────────────────────────────────────────────────────────────────────
 * No hay ninguna ruta pública. Este endpoint corre con la SESIÓN de quien pide
 * —no con clave de servicio—, así que la RLS decide si esa fila es visible: si
 * el expediente es restringido y la persona no tiene acceso, la consulta
 * simplemente no devuelve nada.
 *
 * El enlace firmado dura un minuto. Lo que se pegue por accidente en un chat
 * deja de servir antes de que alguien lo abra.
 */

export const dynamic = 'force-dynamic'

/** Cuánto vive el enlace firmado. */
const VIDA_SEGUNDOS = 60

export async function GET(
  _peticion: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await exigirPanel()
  const { id } = await params

  const supabase = await clienteServidor()

  const { data: documento } = await supabase
    .from('documentos')
    .select('ruta_storage, nombre')
    .eq('id', id)
    .maybeSingle()

  // No se distingue "no existe" de "no tienes acceso": decirle a alguien que
  // el documento existe pero no puede verlo ya filtra información de un asunto
  // ajeno.
  if (!documento) {
    return NextResponse.json({ error: 'No se encontró el documento.' }, { status: 404 })
  }

  const { data, error } = await supabase.storage
    .from('documentos')
    .createSignedUrl(documento.ruta_storage, VIDA_SEGUNDOS, {
      download: documento.nombre,
    })

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: 'El registro existe pero el archivo no se pudo abrir.' },
      { status: 502 },
    )
  }

  return NextResponse.redirect(data.signedUrl)
}

'use server'

import { redirect } from 'next/navigation'

import { prepararRegistro } from '@/lib/despachos/alta'
import {
  anotarFallo,
  evaluarAcceso,
  mensajeDeEspera,
  perdonarAcceso,
} from '@/lib/seguridad/limite-intentos'
import { ipDeLaPeticion } from '@/lib/seguridad/peticion'
import { clienteServidor } from '@/lib/supabase/server'

import { conError, conProblemas, type EstadoRegistro } from './estado'

/**
 * Registro: crea la cuenta y, si Supabase devuelve sesión, el despacho.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * LOS DOS CAMINOS, Y POR QUÉ HAY DOS
 * ─────────────────────────────────────────────────────────────────────────────
 * Si el proyecto exige confirmar el correo, `signUp` NO devuelve sesión. Sin
 * sesión no hay `auth.uid()`, y `crear_mi_despacho` —que a propósito solo actúa
 * sobre el usuario que la llama— no puede correr todavía.
 *
 * Así que el despacho se crea cuando se puede: aquí mismo si hay sesión, o en
 * `/bienvenida` tras el primer acceso. El nombre capturado viaja en los
 * metadatos del usuario para no volver a pedirlo.
 *
 * La alternativa —crear el despacho con clave de servicio desde esta pantalla
 * pública— metería un camino que salta toda la RLS en el flujo más expuesto del
 * sistema. No vale la comodidad.
 */
export async function registrarse(
  _previo: EstadoRegistro,
  formData: FormData,
): Promise<EstadoRegistro> {
  const datos = {
    nombre: String(formData.get('nombre') ?? ''),
    correo: String(formData.get('correo') ?? ''),
    contrasena: String(formData.get('contrasena') ?? ''),
    nombreDespacho: String(formData.get('nombreDespacho') ?? ''),
  }

  const preparado = prepararRegistro(datos)
  if (!preparado.ok) {
    const problemas: Record<string, string> = {}
    // Se conserva el PRIMER problema de cada campo: los siguientes suelen ser
    // consecuencia del mismo error y apilarlos no ayuda a corregirlo.
    for (const p of preparado.problemas) {
      problemas[p.campo] ??= p.mensaje
    }
    return conProblemas(problemas)
  }

  const { plan } = preparado

  // El registro también es una ruta pública que escribe: sin freno, un script
  // llena la tabla de auth y quema la cuota de correo del proyecto.
  const ctx = { ip: await ipDeLaPeticion(), correo: plan.correo }
  const veredicto = evaluarAcceso(ctx)
  if (!veredicto.permitido) return conError(mensajeDeEspera(veredicto))

  const supabase = await clienteServidor()

  const { data, error } = await supabase.auth.signUp({
    email: plan.correo,
    password: datos.contrasena,
    options: {
      data: {
        nombre: plan.nombre,
        despacho_nombre: plan.despacho.nombre,
        despacho_slug_base: plan.despacho.slugBase,
      },
    },
  })

  if (error) {
    anotarFallo(ctx)
    // El mensaje de Supabase distingue "ya registrado" de otros fallos, y eso
    // convierte esta pantalla en un verificador de cuentas. Se unifica.
    return conError(
      'No se pudo crear la cuenta. Revisa los datos o intenta más tarde.',
    )
  }

  perdonarAcceso(ctx)

  // Sin sesión: el proyecto pide confirmar el correo. El despacho se crea en
  // /bienvenida, después del primer acceso.
  if (!data.session) {
    return { error: null, problemas: {}, confirmaCorreo: true }
  }

  const { error: errorDespacho } = await supabase.rpc('crear_mi_despacho', {
    p_nombre_titular: plan.nombre,
    p_correo: plan.correo,
    p_despacho_nombre: plan.despacho.nombre,
    p_slug_base: plan.despacho.slugBase,
  })

  if (errorDespacho) {
    // La cuenta quedó creada y la sesión está abierta; solo faltó el despacho.
    // Mandarlo a /bienvenida es mejor que pedirle que se registre de nuevo, que
    // fallaría por correo duplicado y lo dejaría atorado.
    redirect('/bienvenida')
  }

  redirect('/panel')
}

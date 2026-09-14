/**
 * El material de trabajo para que un abogado verifique el catálogo.
 *
 *   npm run catalogo:dossier > dossier.md
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * POR QUÉ LEE LA BASE Y NO EL REPOSITORIO
 * ─────────────────────────────────────────────────────────────────────────────
 * Las constantes de `src/lib/plazos/catalogo.ts` son la SEMILLA con la que se
 * generó la `0008`; en tiempo de ejecución el sistema solo lee la tabla
 * (CLAUDE.md §5.1). Un documento armado desde el repositorio describiría lo que
 * el código propone, no lo que el motor está usando — y esos dos ya se
 * separaron una vez, con la `0008` sin aplicar y nadie enterado.
 *
 * ⚠️ Va con la clave ANÓNIMA, igual que `verificar:semilla`, y por la misma
 * razón: así es como la aplicación lee de verdad el catálogo compartido. Si una
 * política tapara esas filas, el dossier saldría vacío y eso también sería
 * información. No necesita ningún secreto y no escribe nada.
 *
 * ⚠️ Sin llaves NO imprime un documento vacío: se detiene con estado 2. Un
 * material de verificación que sale en blanco porque no pudo preguntar es peor
 * que no tenerlo: parece que el catálogo está limpio.
 */

import { armarDossier, type EntradaDelCatalogo } from '../src/lib/catalogo/dossier.ts'
import { VIAS } from '../src/lib/expedientes/materias.ts'
import { UNIDAD_ETIQUETA } from '../src/lib/plazos/regimenes.ts'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const llave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !llave) {
  console.error(
    'No se puede armar el dossier: faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  )
  console.error('No es que el catálogo esté vacío: es que no se pudo preguntar.')
  process.exit(2)
}

const COLUMNAS = 'id,clave,regimen,etiqueta,dias,unidad,fundamento,nota,verificado_el'

const respuesta = await fetch(
  `${url}/rest/v1/plazos_catalogo?select=${COLUMNAS}&despacho_id=is.null&order=regimen.asc,clave.asc`,
  { headers: { apikey: llave, Authorization: `Bearer ${llave}` } },
)

if (!respuesta.ok) {
  console.error(`La base contestó ${respuesta.status}: ${await respuesta.text()}`)
  process.exit(1)
}

const entradas = (await respuesta.json()) as EntradaDelCatalogo[]

if (entradas.length === 0) {
  console.error(
    'El catálogo compartido está vacío o no es alcanzable con la clave anónima.',
  )
  console.error('Corre `npm run verificar:semilla` antes de seguir.')
  process.exit(1)
}

// El proyecto, para que el documento diga de dónde salió. Del subdominio, que
// no es un secreto; la llave no se imprime.
const proyecto = new URL(url).hostname.split('.')[0] ?? url

console.log(
  armarDossier({
    entradas,
    vias: VIAS.map((v) => ({ id: v.id, nombre: v.nombre, regimen: v.regimen })),
    generadoEl: new Date().toISOString().slice(0, 10),
    proyecto,
    unidadEn: (u) => UNIDAD_ETIQUETA[u as keyof typeof UNIDAD_ETIQUETA] ?? `días ${u}`,
  }),
)

/**
 * Armado de correos (puro, sin efectos y sin red).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * TABLAS, NO FLEX. Y SIEMPRE VERSIÓN DE TEXTO.
 * ─────────────────────────────────────────────────────────────────────────────
 * Outlook de escritorio sigue componiendo con el motor de Word: no entiende
 * flexbox, ni grid, ni la mitad de las hojas de estilo modernas. Un correo que
 * se ve bien en Gmail y se desarma en Outlook es un correo roto para media
 * profesión legal en México.
 *
 * Y **siempre** va la versión de texto plano. No es cortesía: un correo que
 * solo trae HTML puntúa peor en los filtros de spam, y este correo tiene que
 * llegar — es el que abre la puerta del despacho.
 */

export interface Correo {
  asunto: string
  html: string
  texto: string
}

function escapar(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface CuerpoCorreo {
  titulo: string
  /** Párrafos, en orden. Se escapan: aquí entra texto tecleado por gente. */
  parrafos: readonly string[]
  boton?: { texto: string; url: string }
  /** El enlace en claro, para quien no puede oprimir el botón. */
  enlaceLiteral?: string
  pie?: string
}

const TINTA = '#16202a'
const TINTA_SUAVE = '#5b6874'
const FOJA = '#fbfbf9'
const ARCHIVO = '#e2e6de'
const REGLA = '#cdd3c9'
const SELLO = '#5b3b8c'

/**
 * El correo, en el mismo lenguaje visual que la aplicación.
 *
 * Todos los colores van en línea y literales: ningún cliente de correo carga
 * una hoja externa, y las variables CSS no existen para Outlook.
 */
export function armarCorreo(marca: string, cuerpo: CuerpoCorreo): Correo {
  const parrafosHtml = cuerpo.parrafos
    .map(
      (p) =>
        `<p style="margin:0 0 14px;color:${TINTA};font-size:15px;line-height:1.55">${escapar(p)}</p>`,
    )
    .join('')

  const botonHtml = cuerpo.boton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0">
         <tr><td style="background:${TINTA};border-radius:3px">
           <a href="${escapar(cuerpo.boton.url)}" style="display:inline-block;padding:11px 20px;color:${FOJA};font-size:14px;font-weight:600;text-decoration:none">${escapar(cuerpo.boton.texto)}</a>
         </td></tr>
       </table>`
    : ''

  const literalHtml = cuerpo.enlaceLiteral
    ? `<p style="margin:0 0 14px;color:${TINTA_SUAVE};font-size:12px;line-height:1.5;word-break:break-all">Si el botón no funciona, copia esta dirección en tu navegador:<br>${escapar(cuerpo.enlaceLiteral)}</p>`
    : ''

  const pieHtml = cuerpo.pie
    ? `<p style="margin:18px 0 0;padding-top:14px;border-top:1px solid ${REGLA};color:${TINTA_SUAVE};font-size:12px;line-height:1.5">${escapar(cuerpo.pie)}</p>`
    : ''

  const html = `<!doctype html>
<html lang="es-MX"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapar(cuerpo.titulo)}</title></head>
<body style="margin:0;padding:0;background:${ARCHIVO}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${ARCHIVO};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:${FOJA};border:1px solid ${REGLA};border-radius:3px">
      <tr><td style="padding:24px 26px">
        <p style="margin:0 0 18px;color:${SELLO};font-size:15px;font-weight:700;letter-spacing:-0.01em">${escapar(marca)}</p>
        <h1 style="margin:0 0 14px;color:${TINTA};font-size:20px;line-height:1.25;font-weight:600">${escapar(cuerpo.titulo)}</h1>
        ${parrafosHtml}
        ${botonHtml}
        ${literalHtml}
        ${pieHtml}
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`

  const texto = [
    marca.toUpperCase(),
    '',
    cuerpo.titulo,
    '',
    ...cuerpo.parrafos,
    cuerpo.boton ? `\n${cuerpo.boton.texto}: ${cuerpo.boton.url}` : '',
    cuerpo.enlaceLiteral && !cuerpo.boton ? `\n${cuerpo.enlaceLiteral}` : '',
    cuerpo.pie ? `\n${cuerpo.pie}` : '',
  ]
    .filter((linea) => linea !== '')
    .join('\n')

  return { asunto: cuerpo.titulo, html, texto }
}

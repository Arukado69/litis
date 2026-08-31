import { describe, expect, it } from 'vitest'

import { armarCorreo } from './plantilla'

const CUERPO = {
  titulo: 'Te invitaron a un despacho',
  parrafos: ['Nadia Ruiz te invitó a Despacho Ruiz como abogado.'],
  boton: { texto: 'Aceptar la invitación', url: 'https://litis.mx/invitacion/abc' },
  enlaceLiteral: 'https://litis.mx/invitacion/abc',
  pie: 'El enlace caduca en 7 días.',
}

describe('armarCorreo', () => {
  it('siempre trae versión de texto plano', () => {
    // Un correo solo-HTML puntúa peor en los filtros de spam, y este es el que
    // abre la puerta del despacho: tiene que llegar.
    const correo = armarCorreo('Litis', CUERPO)
    expect(correo.texto.length).toBeGreaterThan(0)
    expect(correo.texto).toContain('Nadia Ruiz te invitó')
  })

  it('el enlace aparece también en la versión de texto', () => {
    const correo = armarCorreo('Litis', CUERPO)
    expect(correo.texto).toContain('https://litis.mx/invitacion/abc')
  })

  it('maqueta con tablas, no con flex', () => {
    // Outlook de escritorio compone con el motor de Word: no entiende flexbox.
    const correo = armarCorreo('Litis', CUERPO)
    expect(correo.html).toContain('<table')
    expect(correo.html).not.toContain('display:flex')
    expect(correo.html).not.toContain('display:grid')
  })

  it('no usa variables CSS: para un cliente de correo no existen', () => {
    expect(armarCorreo('Litis', CUERPO).html).not.toContain('var(--')
  })

  it('escapa lo que teclea la gente', () => {
    // El nombre de un despacho lo escribe una persona, y de ahí sale al correo
    // de otra.
    const correo = armarCorreo('Litis', {
      titulo: 'Hola',
      parrafos: ['<script>alert(1)</script> & "comillas"'],
    })
    expect(correo.html).not.toContain('<script>')
    expect(correo.html).toContain('&lt;script&gt;')
    expect(correo.html).toContain('&amp;')
  })

  it('escapa también el título y la URL del botón', () => {
    const correo = armarCorreo('Litis', {
      titulo: '<b>x</b>',
      parrafos: [],
      boton: { texto: 'Ir', url: 'https://x.mx/"onmouseover="alert(1)' },
    })
    expect(correo.html).not.toContain('<b>x</b>')
    expect(correo.html).not.toContain('"onmouseover="')
  })

  it('el asunto es el título', () => {
    expect(armarCorreo('Litis', CUERPO).asunto).toBe(CUERPO.titulo)
  })

  it('funciona sin botón ni pie', () => {
    const correo = armarCorreo('Litis', { titulo: 'Aviso', parrafos: ['Algo pasó.'] })
    expect(correo.html).toContain('Algo pasó.')
    expect(correo.texto).toContain('Algo pasó.')
  })

  it('sin botón, el enlace literal igual sale en el texto', () => {
    const correo = armarCorreo('Litis', {
      titulo: 'Aviso',
      parrafos: [],
      enlaceLiteral: 'https://litis.mx/x',
    })
    expect(correo.texto).toContain('https://litis.mx/x')
  })

  it('lleva la marca y el idioma declarado', () => {
    const correo = armarCorreo('Litis', CUERPO)
    expect(correo.html).toContain('lang="es-MX"')
    expect(correo.html).toContain('Litis')
  })
})

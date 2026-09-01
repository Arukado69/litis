import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

const raizProyecto = path.dirname(fileURLToPath(import.meta.url))

/**
 * Cabeceras de seguridad.
 *
 * Son las que protegen de verdad sin obligar a emitir un nonce por petición:
 * clickjacking sobre el panel, secuestro de la base de URLs relativas, envío
 * de formularios a otro origen y carga de plugins.
 *
 * ⚠️ La CSP de aquí NO detiene un XSS. `script-src` lleva 'unsafe-inline'
 * porque Next hidrata con scripts en línea, y cerrarlo de verdad exige emitir
 * un nonce por petición desde el proxy. Queda dicho en vez de fingir que
 * protege.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://api.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const nextConfig: NextConfig = {
  output: 'standalone',

  /**
   * Las Server Actions aceptan 1 MB por omisión, y por ahí sube un escaneo de
   * un expediente con anexos. Se levanta un poco POR ENCIMA del tope propio
   * (25 MB, en `lib/documentos/archivos.ts`) para que el archivo demasiado
   * grande lo rechace nuestra validación —con un mensaje que dice qué hacer—
   * y no el runtime con un error que no explica nada.
   */
  experimental: { serverActions: { bodySizeLimit: '30mb' } },

  // Raíz explícita. Next la infiere subiendo hasta encontrar un lockfile, y si
  // este proyecto queda anidado dentro de otro (como durante el trasplante
  // desde ns-hub) termina compilando archivos del padre. Fijarla también
  // evita el aviso de raíz de workspace ambigua.
  turbopack: { root: raizProyecto },
  outputFileTracingRoot: raizProyecto,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ]
  },
}

export default nextConfig

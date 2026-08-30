import coreWebVitals from 'eslint-config-next/core-web-vitals'
import typescript from 'eslint-config-next/typescript'

/**
 * `eslint-config-next` 16 exporta config plana nativa. No se usa el puente
 * `FlatCompat`: al pasar estos paquetes por él, ESLint intenta serializar la
 * config para validarla y truena con "Converting circular structure to JSON",
 * porque los plugins de React se referencian entre sí.
 */
const config = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default config

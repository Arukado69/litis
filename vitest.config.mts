import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  // Las pruebas son de lógica pura y no tocan CSS. Con un objeto vacío, Vite
  // deja de buscar `postcss.config.mjs`: si lo busca, encuentra el de Next
  // —que declara los plugins como cadenas, forma que Next entiende y Vite no—
  // y revienta antes de correr un solo caso.
  css: { postcss: {} },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['node_modules', '.nuxt', '.output', 'dist', 'e2e'],
  },
})

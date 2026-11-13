import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'vite.config.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/server/**', 'src/lib/**'],
      exclude: ['**/*.test.*'],
      thresholds: { lines: 80 },
    },
  },
})

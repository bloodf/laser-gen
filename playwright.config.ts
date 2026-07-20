import { defineConfig, devices } from '@playwright/test'

/**
 * E2E suite runs against a production build served by `nuxt preview`
 * (the service worker only registers in a production build — `pwa.devOptions`
 * is disabled — so `nuxt dev` is not an option here).
 *
 * The webServer command builds first so `pnpm test:e2e` is self-contained.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  // The studio page mounts a WebGL 3D viewer — page loads and assertions are
  // slow under parallel workers, so give tests room.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm build && NITRO_PORT=4173 pnpm preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})

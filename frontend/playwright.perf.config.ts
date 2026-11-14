import { defineConfig, devices } from '@playwright/test'

/**
 * Performance budgets run against the production build (`vite preview`), not
 * the dev server: HMR and unminified modules make dev numbers meaningless.
 *
 * Usage: `npm run test:perf` (builds automatically).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /perf\.spec\.ts/,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
})

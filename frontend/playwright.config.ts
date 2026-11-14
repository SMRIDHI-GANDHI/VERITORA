import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  testIgnore: ['**/perf.spec.ts', '**/fixtures.ts'],
  fullyParallel: true,
  // Axe runs are CPU-heavy; 30s was too tight when two workers analyse admin
  // tables at the same time on a busy developer machine.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // The API is required for authenticated journeys and the authenticated
      // axe sweep. Start PostgreSQL and apply migrations first, then seed the
      // demo accounts: `cd backend && python -m app.scripts.seed_demo`.
      command: 'python -m uvicorn app.main:app --host 127.0.0.1 --port 8000',
      url: 'http://127.0.0.1:8000/healthz',
      cwd: '../backend',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})

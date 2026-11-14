import { expect, request as playwrightRequest } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { API, DEMO_EMAILS, DEMO_PASSWORD, type Role, type Session } from './env'

/**
 * Logs in the seeded demo accounts once per `playwright test` run and writes
 * their access tokens for the worker fixtures.
 *
 * Doing this in global setup keeps login calls to two per run (the auth
 * endpoint is limited to 5/minute per IP). Tests never call `/auth/login`
 * themselves and never share a rotating refresh cookie.
 *
 * Prerequisite: `cd backend && python -m app.scripts.seed_demo`.
 */
async function login(role: Role): Promise<Session> {
  const context = await playwrightRequest.newContext()
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const res = await context.post(`${API}/auth/login`, {
        data: { email: DEMO_EMAILS[role], password: DEMO_PASSWORD },
      })

      if (res.status() === 429 && attempt === 0) {
        // Rate limiting is per IP and the window is one minute. Reruns land in
        // the same window, so respect Retry-After rather than fail spuriously.
        const retryAfter = Number(res.headers()['retry-after'] ?? 60)
        await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
        continue
      }

      expect(
        res.ok(),
        `Demo login failed for ${DEMO_EMAILS[role]} (${res.status()}). Seed the demo accounts: ` +
          '`cd backend && python -m app.scripts.seed_demo`.',
      ).toBeTruthy()
      const session = (await res.json()) as Session
      expect(session.access_token, 'login response is missing access_token').toBeTruthy()
      return session
    }
    throw new Error(`login for ${role} did not succeed`)
  } finally {
    await context.dispose()
  }
}

export default async function globalSetup() {
  const dir = path.resolve(process.cwd(), 'e2e', '.auth')
  fs.mkdirSync(dir, { recursive: true })

  const sessions = {
    user: await login('user'),
    moderator: await login('moderator'),
  }

  fs.writeFileSync(path.join(dir, 'tokens.json'), JSON.stringify(sessions), 'utf8')
}

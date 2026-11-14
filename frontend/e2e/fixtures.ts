import { test as base, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import type { Session } from './env'

type Tokens = { user: Session; moderator: Session }

function readTokens(): Tokens {
  const file = path.resolve(process.cwd(), 'e2e', '.auth', 'tokens.json')
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Tokens
}

/**
 * The demo sessions are created once by `global-setup.ts`. These worker-scoped
 * fixtures only read the tokens, so parallel workers never rotate a shared
 * refresh cookie and never hit the login rate limit.
 */
export const test = base.extend<Record<string, never>, { userAuth: Session; moderatorAuth: Session }>({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires the fixture-object argument.
  userAuth: [async ({}, use) => use(readTokens().user), { scope: 'worker' }],
  // eslint-disable-next-line no-empty-pattern
  moderatorAuth: [async ({}, use) => use(readTokens().moderator), { scope: 'worker' }],
})

export { expect }

/**
 * Makes the SPA treat the given session as an existing signed-in session by
 * fulfilling its `/auth/refresh` call with the worker's real access token.
 */
export async function signIn(page: Page, session: Session) {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(session),
    }),
  )
}

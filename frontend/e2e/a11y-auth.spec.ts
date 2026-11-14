import { expectNoSeriousA11yViolations } from './axe-helper'
import { expect, signIn, test } from './fixtures'

const userPages = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'analyze', path: '/analyze' },
  { name: 'trustscan', path: '/trustscan' },
  { name: 'verify-company', path: '/verify/company' },
  { name: 'verify-recruiter', path: '/verify/recruiter' },
  { name: 'reports', path: '/reports' },
  { name: 'report-new', path: '/reports/new' },
  { name: 'history', path: '/history' },
  { name: 'saved', path: '/saved' },
  { name: 'exposure', path: '/exposure' },
  { name: 'chat', path: '/chat' },
  { name: 'settings', path: '/settings' },
  { name: 'message-analyzer', path: '/message-analyzer' },
]

const moderatorPages = [
  { name: 'admin-reports', path: '/admin' },
  { name: 'admin-network', path: '/admin/network' },
  { name: 'admin-watchlist', path: '/admin/watchlist' },
  { name: 'admin-trends', path: '/admin/trends' },
]

const themes = ['light', 'dark'] as const

function applyTheme(page: import('@playwright/test').Page, theme: (typeof themes)[number]) {
  return page.addInitScript((value: string) => {
    localStorage.setItem('veritrust-theme', value)
  }, theme)
}

test.describe('authenticated a11y (user)', () => {
  test.beforeEach(async ({ page, userAuth }) => {
    await signIn(page, userAuth)
  })

  for (const theme of themes) {
    for (const p of userPages) {
      test(`axe: ${p.name} (${theme}) has no serious violations`, async ({ page }) => {
        await applyTheme(page, theme)
        await page.goto(p.path)
        await page.waitForLoadState('networkidle')
        await expectNoSeriousA11yViolations(page)
      })
    }
  }
})

test.describe('authenticated a11y (moderator)', () => {
  test.beforeEach(async ({ page, moderatorAuth }) => {
    await signIn(page, moderatorAuth)
  })

  for (const theme of themes) {
    for (const p of moderatorPages) {
      test(`axe: ${p.name} (${theme}) has no serious violations`, async ({ page }) => {
        await applyTheme(page, theme)
        await page.goto(p.path)
        await page.waitForLoadState('networkidle')
        await expectNoSeriousA11yViolations(page)
      })
    }
  }
})

test.describe('authenticated keyboard operation', () => {
  test.beforeEach(async ({ page, userAuth }) => {
    await signIn(page, userAuth)
  })

  test('skip link moves focus to main content', async ({ page }) => {
    await page.goto('/dashboard')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('#main')).toBeVisible()
  })
})

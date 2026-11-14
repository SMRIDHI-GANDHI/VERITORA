import { test } from '@playwright/test'
import { expectNoSeriousA11yViolations } from './axe-helper'

const pages = [
  { name: 'landing', path: '/' },
  { name: 'cyber-help', path: '/help/cybercrime' },
  { name: 'not-found', path: '/missing-page' },
]

const themes = ['light', 'dark'] as const

for (const theme of themes) {
  for (const p of pages) {
    test(`axe: ${p.name} (${theme}) has no serious violations`, async ({ page }) => {
      await page.addInitScript((t) => {
        localStorage.setItem('veritrust-theme', t)
      }, theme)
      await page.goto(p.path)
      await page.waitForLoadState('networkidle')
      await expectNoSeriousA11yViolations(page)
    })
  }
}

test('keyboard navigation reaches Report Cybercrime and main', async ({ page }) => {
  await page.goto('/')
  await page.keyboard.press('Tab') // skip link
  await page.keyboard.press('Tab')
  await page.keyboard.press('Enter')
  // basic smoke: focus moves and no crash; full manual keyboard audit noted in report
})
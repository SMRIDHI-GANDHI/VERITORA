/* Capture desktop + mobile screenshots of key pages into .impeccable/review/. */
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5183'
const OUT = join(process.cwd(), '.impeccable', 'review')

const routes = [
  { name: 'landing', path: '/' },
  { name: 'signin', path: '/signin' },
  { name: 'signup', path: '/signup' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'analyze', path: '/analyze' },
  { name: 'history', path: '/history' },
  { name: 'cyber-help', path: '/cyber-help' },
  { name: 'settings', path: '/settings' },
]

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch()
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: 'light',
    })
    const page = await ctx.newPage()
    for (const r of routes) {
      await page.goto(`${BASE}${r.path}`, { waitUntil: 'networkidle' }).catch(() => undefined)
      await page.waitForTimeout(300)
      await page.screenshot({ path: join(OUT, `${r.name}-${vp.name}.png`) })
      console.log(`captured ${r.name}-${vp.name}`)
    }
    await ctx.close()
  }
  // dark theme landing + dashboard
  const dark = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
  })
  const dp = await dark.newPage()
  for (const r of [routes[0], routes[3]]) {
    await dp.goto(`${BASE}${r.path}`, { waitUntil: 'networkidle' }).catch(() => undefined)
    await dp.waitForTimeout(300)
    await dp.screenshot({ path: join(OUT, `${r.name}-dark.png`) })
    console.log(`captured ${r.name}-dark`)
  }
  await dark.close()
  await browser.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

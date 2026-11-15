import { chromium } from '@playwright/test'

const BASE = process.env.CAPTURE_BASE ?? 'http://127.0.0.1:5183'

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('console', (m) => console.log(`[console.${m.type()}] ${m.text()}`))
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))
page.on('requestfailed', (r) => console.log(`[reqfail] ${r.url()} ${r.failure()?.errorText}`))
const resp = await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch((e) => {
  console.log(`[goto-error] ${e.message}`)
  return null
})
console.log(`[status] ${resp?.status()}`)
await page.waitForTimeout(1000)
console.log(`[title] ${await page.title()}`)
console.log(`[body-len] ${(await page.content()).length}`)
const text = await page.evaluate(() => document.body.innerText.slice(0, 500))
console.log(`[body-text] ${JSON.stringify(text)}`)
await browser.close()

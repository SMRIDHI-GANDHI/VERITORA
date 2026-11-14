import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Performance budgets (Lighthouse-equivalent metrics without adding a
 * dependency outside docs/02-TRD.md).
 *
 * Thresholds are deliberately conservative for CI runners while still
 * catching regressions: a page that ships a 2 MB bundle or blocks painting for
 * several seconds fails.
 */
const BUDGET = {
  lcpMs: 2500,
  cls: 0.1,
  ttfbMs: 800,
  totalJsBytes: 700 * 1024,
  largestJsBytes: 420 * 1024,
}

type Metrics = {
  lcp: number
  cls: number
  ttfb: number
  domContentLoaded: number
}

async function collectMetrics(page: import('@playwright/test').Page): Promise<Metrics> {
  return page.evaluate(
    () =>
      new Promise<Metrics>((resolve) => {
        let lcp = 0
        let cls = 0

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) lcp = entry.startTime
          }).observe({ type: 'largest-contentful-paint', buffered: true })
        } catch {
          // Browser without LCP support: leave at 0 and rely on the other budgets.
        }

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
              if (!shift.hadRecentInput && typeof shift.value === 'number') cls += shift.value
            }
          }).observe({ type: 'layout-shift', buffered: true })
        } catch {
          // Layout instability API unavailable.
        }

        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined

        // Give buffered observers a tick to flush before reading the values.
        window.setTimeout(() => {
          resolve({
            lcp,
            cls,
            ttfb: nav?.responseStart ?? 0,
            domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
          })
        }, 250)
      }),
  )
}

test.describe('performance budgets', () => {
  test('landing page meets the web-vitals budget', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const metrics = await collectMetrics(page)

    expect(metrics.ttfb, 'time to first byte').toBeLessThan(BUDGET.ttfbMs)
    expect(metrics.lcp, 'largest contentful paint').toBeLessThan(BUDGET.lcpMs)
    expect(metrics.cls, 'cumulative layout shift').toBeLessThan(BUDGET.cls)
  })

  test('production JavaScript stays within the bundle budget', async () => {
    const assets = path.resolve(process.cwd(), 'dist', 'assets')
    expect(fs.existsSync(assets), 'run `npm run build` before the perf budget').toBeTruthy()

    const jsFiles = fs.readdirSync(assets).filter((file) => file.endsWith('.js'))
    expect(jsFiles.length).toBeGreaterThan(0)

    const sizes = jsFiles.map((file) => ({
      file,
      bytes: fs.statSync(path.join(assets, file)).size,
    }))

    const total = sizes.reduce((sum, entry) => sum + entry.bytes, 0)
    const largest = sizes.reduce((max, entry) => Math.max(max, entry.bytes), 0)

    expect(total, `total JS: ${JSON.stringify(sizes)}`).toBeLessThan(BUDGET.totalJsBytes)
    expect(largest, `largest JS chunk: ${JSON.stringify(sizes)}`).toBeLessThan(BUDGET.largestJsBytes)
  })
})

import { expect, test } from '@playwright/test'

/**
 * NFR-A11Y-1: reduced-motion must be respected.
 *
 * The global CSS rule in `src/index.css` collapses animation and transition
 * durations when the OS asks for reduced motion. This test reads the computed
 * styles for every rendered element (rather than trusting the stylesheet) so a
 * component that later opts out with an inline style fails loudly.
 */
test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('animations and transitions are effectively disabled', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const offenders = await page.evaluate(() => {
      const paths: string[] = []
      for (const el of Array.from(document.querySelectorAll('*'))) {
        const style = getComputedStyle(el)
        const transition = parseFloat(style.transitionDuration || '0')
        const animation = parseFloat(style.animationDuration || '0')
        if (transition > 0.001 || animation > 0.001) {
          paths.push(`${el.tagName.toLowerCase()}.${el.className}`)
        }
      }
      return paths
    })

    expect(offenders, `elements still animating: ${offenders.join(', ')}`).toEqual([])
  })
})

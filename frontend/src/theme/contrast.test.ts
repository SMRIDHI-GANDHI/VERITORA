import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Palette contrast guard.
 *
 * Parses the CSS custom properties from `src/index.css` for both themes and
 * asserts that every foreground/background pair used in the UI meets WCAG 2 AA
 * (>= 4.5:1 for normal text). This is a build-time guard: changing a colour
 * token that breaks contrast fails the test suite instead of shipping.
 */

type Rgb = [number, number, number]

const MIN_RATIO = 4.5

function parsePalettes(css: string): { light: Record<string, Rgb>; dark: Record<string, Rgb> } {
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/)
  const darkMatch = css.match(/\.dark\s*\{([\s\S]*?)\}/)
  if (!rootMatch || !darkMatch) {
    throw new Error('Could not find :root or .dark blocks in index.css')
  }
  const parse = (block: string): Record<string, Rgb> => {
    const out: Record<string, Rgb> = {}
    const re = /--color-([a-z0-9-]+)\s*:\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g
    let m: RegExpExecArray | null
    while ((m = re.exec(block)) !== null) {
      out[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])]
    }
    return out
  }
  return { light: parse(rootMatch[1]), dark: parse(darkMatch[1]) }
}

function channel(c: number): number {
  const x = c / 255
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(channel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: Rgb, bg: Rgb): number {
  const a = luminance(fg)
  const b = luminance(bg)
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

/** Composite a translucent foreground over an opaque background. */
function over(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as Rgb
}

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf-8')
const palettes = parsePalettes(css)

type Pair = {
  label: string
  fg: (p: Record<string, Rgb>) => Rgb
  bg: (p: Record<string, Rgb>) => Rgb
}

const pairs: Pair[] = [
  { label: 'body text on bg', fg: (p) => p.text, bg: (p) => p.bg },
  { label: 'body text on surface', fg: (p) => p.text, bg: (p) => p.surface },
  { label: 'heading on bg', fg: (p) => p.heading, bg: (p) => p.bg },
  { label: 'muted on bg', fg: (p) => p.muted, bg: (p) => p.bg },
  { label: 'muted on surface', fg: (p) => p.muted, bg: (p) => p.surface },
  {
    label: 'muted on surface2/40 tint',
    fg: (p) => p.muted,
    bg: (p) => over(p['surface-2'], p.bg, 0.4),
  },
  { label: 'ash metadata on bg', fg: (p) => p.ash, bg: (p) => p.bg },
  { label: 'ash metadata on surface', fg: (p) => p.ash, bg: (p) => p.surface },
  { label: 'accent link on surface', fg: (p) => p.accent, bg: (p) => p.surface },
  { label: 'accent link on bg', fg: (p) => p.accent, bg: (p) => p.bg },
  {
    label: 'accent link on surface2/40 tint',
    fg: (p) => p.accent,
    bg: (p) => over(p['surface-2'], p.bg, 0.4),
  },
  {
    label: 'accent on accent/10 tint',
    fg: (p) => p.accent,
    bg: (p) => over(p.accent, p.surface, 0.1),
  },
  { label: 'danger on surface', fg: (p) => p.danger, bg: (p) => p.surface },
  {
    label: 'danger on danger/10 tint',
    fg: (p) => p.danger,
    bg: (p) => over(p.danger, p.surface, 0.1),
  },
  {
    label: 'danger on danger/15 tint',
    fg: (p) => p.danger,
    bg: (p) => over(p.danger, p.surface, 0.15),
  },
  { label: 'warning on surface', fg: (p) => p.warning, bg: (p) => p.surface },
  {
    label: 'warning on warning/10 tint',
    fg: (p) => p.warning,
    bg: (p) => over(p.warning, p.surface, 0.1),
  },
  { label: 'success on surface', fg: (p) => p.success, bg: (p) => p.surface },
  {
    label: 'success on success/10 tint',
    fg: (p) => p.success,
    bg: (p) => over(p.success, p.surface, 0.1),
  },
  { label: 'stamp on surface', fg: (p) => p.stamp, bg: (p) => p.surface },
  {
    label: 'stamp on stamp/10 tint',
    fg: (p) => p.stamp,
    bg: (p) => over(p.stamp, p.surface, 0.1),
  },
  {
    label: 'ash on ash/10 tint',
    fg: (p) => p.ash,
    bg: (p) => over(p.ash, p.surface, 0.1),
  },
  { label: 'button text on button bg', fg: (p) => p['button-text'], bg: (p) => p['button-bg'] },
  // The file cover: paper text on the ink-blue rail (both themes).
  { label: 'paper on cover rail', fg: (p) => p.paper, bg: (p) => p.cover },
  {
    label: 'paper/90 on cover rail',
    fg: (p) => over(p.paper, p.cover, 0.9),
    bg: (p) => p.cover,
  },
  {
    label: 'paper on cover/80 over bg',
    fg: (p) => p.paper,
    bg: (p) => over(p.cover, p.bg, 0.8),
  },
  {
    label: 'paper on cover/20 active nav',
    fg: (p) => p.paper,
    bg: (p) => over(p.paper, p.cover, 0.2),
  },
]

describe('palette contrast (WCAG 2 AA)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const pair of pairs) {
      it(`${theme}: ${pair.label} >= ${MIN_RATIO}:1`, () => {
        const palette = palettes[theme]
        const r = contrast(pair.fg(palette), pair.bg(palette))
        expect(r, `${theme} - ${pair.label} is ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(MIN_RATIO)
      })
    }
  }

  it('paper remains a light colour in the dark theme (cover rail legibility)', () => {
    const lightPaper = palettes.light.paper
    const darkPaper = palettes.dark.paper
    expect(luminance(darkPaper)).toBeGreaterThan(luminance(palettes.dark.cover))
    expect(darkPaper).toEqual(lightPaper)
  })

  it('every token exists in both themes', () => {
    for (const token of Object.keys(palettes.light)) {
      expect(palettes.dark[token], `token ${token} is missing from the dark theme`).toBeDefined()
    }
  })
})

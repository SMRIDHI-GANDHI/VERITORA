import en from './en.json'
import hi from './hi.json'

function flatten(obj: unknown, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return prefix ? [prefix] : []
  const out: string[] = []
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v, key))
    else out.push(key)
  }
  return out
}

describe('i18n key parity', () => {
  it('en and hi have the same translation keys', () => {
    const enKeys = flatten(en).sort()
    const hiKeys = flatten(hi).sort()
    expect(hiKeys).toEqual(enKeys)
  })
})

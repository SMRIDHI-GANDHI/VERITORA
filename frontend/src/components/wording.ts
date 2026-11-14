import type { RiskFactor, WordingExplanationItem } from '../lib/api'

type Span = { start: number; end: number }
export type WordingExcerpt = { text: string; codes: string[] }

/**
 * Plain-language wording checks are scoped to the evidence excerpts that
 * triggered risk factors. The original text is always visible; the endpoint
 * only adds rule-based explanations.
 */
export function collectWordingExcerpts(factors: RiskFactor[]): WordingExcerpt[] {
  const byText = new Map<string, WordingExcerpt>()
  for (const factor of factors) {
    const text = (factor.evidence?.excerpt || '').trim()
    if (!text) continue
    const key = text.toLowerCase()
    const existing = byText.get(key)
    if (existing) {
      if (factor.code && !existing.codes.includes(factor.code)) existing.codes.push(factor.code)
    } else {
      byText.set(key, { text, codes: factor.code ? [factor.code] : [] })
    }
  }
  return [...byText.values()]
}

/** Match API-returned clauses back to the untrusted excerpt for highlighting. */
export function clauseSpans(text: string, explanations: WordingExplanationItem[]): Span[] {
  const spans: Span[] = []
  const lowerText = text.toLowerCase()
  for (const item of explanations) {
    const clause = (item.clause || '').trim()
    if (!clause) continue
    let start = text.indexOf(clause)
    let length = clause.length
    if (start < 0) {
      const lowerClause = clause.toLowerCase()
      start = lowerText.indexOf(lowerClause)
      length = lowerClause.length
    }
    if (start < 0) continue
    const span = { start, end: start + length }
    if (spans.some((existing) => span.start < existing.end && span.end > existing.start)) continue
    spans.push(span)
  }
  return spans.sort((a, b) => a.start - b.start)
}

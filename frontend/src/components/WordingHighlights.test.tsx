import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { vi } from 'vitest'
import i18n from '../i18n'
import type { RiskFactor } from '../lib/api'
import { WordingHighlights } from './WordingHighlights'
import { clauseSpans, collectWordingExcerpts } from './wording'

const mockExplainWording = vi.fn()

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    explainWording: (payload: { text: string }) => mockExplainWording(payload),
  }
})

function renderHighlights(text: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <WordingHighlights excerpts={[{ text, codes: ['UPFRONT_PAYMENT'] }]} />
    </I18nextProvider>,
  )
}

describe('WordingHighlights', () => {
  beforeEach(() => {
    mockExplainWording.mockReset()
  })

  it('deduplicates evidence excerpts and keeps every factor code', () => {
    const factors: RiskFactor[] = [
      { code: 'UPFRONT_PAYMENT', evidence: { excerpt: 'Pay the registration fee' } },
      { code: 'ARTIFICIAL_URGENCY', evidence: { excerpt: 'Pay the registration fee' } },
      { code: 'NO_EXCERPT', evidence: { excerpt: null } },
      { code: 'OTHER', evidence: { excerpt: 'Reply within 24 hours' } },
    ]

    expect(collectWordingExcerpts(factors)).toEqual([
      { text: 'Pay the registration fee', codes: ['UPFRONT_PAYMENT', 'ARTIFICIAL_URGENCY'] },
      { text: 'Reply within 24 hours', codes: ['OTHER'] },
    ])
  })

  it('maps returned clauses to spans without overlapping highlights', () => {
    const spans = clauseSpans('Pay registration fee within 24 hours', [
      { clause: 'registration fee', explanation: 'a' },
      { clause: 'registration fee', explanation: 'b' },
      { clause: null, explanation: 'fallback' },
      { clause: 'not present', explanation: 'c' },
    ])

    expect(spans).toEqual([{ start: 4, end: 20 }])
  })

  it('highlights explained phrases and shows the plain-language explanation', async () => {
    const text = 'Pay Rs 1500 registration fee within 24 hours.'
    mockExplainWording.mockResolvedValue({
      original_text: text,
      explanations: [
        {
          clause: 'registration fee',
          explanation: 'Requests for upfront payment require strong independent verification.',
          confidence: 'medium',
          method: 'rule_based',
        },
      ],
    })
    const user = userEvent.setup()
    const { container } = renderHighlights(text)

    expect(screen.getByText(text)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Explain evidence wording' }))

    expect(await screen.findByText(/upfront payment require strong/i)).toBeInTheDocument()
    const marks = container.querySelectorAll('mark')
    expect(marks).toHaveLength(1)
    expect(marks[0]).toHaveTextContent('registration fee')
    expect(mockExplainWording).toHaveBeenCalledWith({ text })
    expect(screen.getByText(/Rule-based/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/\bfake\b|\bgenuine\b/i)
  })

  it('keeps the original evidence visible when the wording check fails', async () => {
    const text = 'Pay the non-refundable processing fee today.'
    mockExplainWording.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderHighlights(text)

    await user.click(screen.getByRole('button', { name: 'Explain evidence wording' }))

    expect(await screen.findByText(/unavailable right now/i))
  .toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
  })
})

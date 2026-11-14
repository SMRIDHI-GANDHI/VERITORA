import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../i18n'
import type { AnalysisResult } from '../lib/api'
import { MessageAnalysis } from './MessageAnalysis'

const messages = [
  { sender: 'recruiter', text: 'Hi, thanks for applying.' },
  { sender: 'recruiter', text: 'Pay Rs 1500 registration fee within 24 hours.' },
]

const result: AnalysisResult = {
  id: 'conversation',
  risk_band: 'high_concern',
  risk_score: 71,
  summary: 'Conversation analyzed for warning signs and escalation patterns.',
  risk_factors: [
    {
      code: 'UPFRONT_PAYMENT',
      severity: 'high',
      confidence: 'high',
      explanation: 'The text asks the candidate to pay money as part of the process.',
      evidence: { excerpt: 'Pay Rs 1500 registration fee', span: { start: 0, end: 28 } },
      source: { type: 'message:1:recruiter' },
      evidence_key: 'UPFRONT_PAYMENT:1',
    },
    {
      code: 'ARTIFICIAL_URGENCY',
      severity: 'medium',
      confidence: 'medium',
      explanation: 'The text creates pressure to act immediately.',
      evidence: { excerpt: 'within 24 hours', span: { start: 29, end: 44 } },
      source: { type: 'message:1:recruiter' },
      evidence_key: 'ARTIFICIAL_URGENCY:1',
    },
    {
      code: 'ESCALATING_PRESSURE',
      severity: 'medium',
      confidence: 'medium',
      explanation: 'Conversation shows escalating pressure or a delayed payment request across messages.',
      evidence: { excerpt: null, span: null },
      source: { type: 'conversation' },
      evidence_key: 'ESCALATING_PRESSURE:conv:1',
    },
  ],
  recommendations: [
    { code: 'CONTACT_1930_IF_PAID', priority: 1, text: 'If money was sent, contact the cybercrime helpline.' },
  ],
  unknowns: ['Unknown recruiter identity'],
  missing_information: ['Company registration details'],
  notes: [],
}

function renderAnalysis(data: AnalysisResult = result) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MessageAnalysis messages={messages} data={data} />
    </I18nextProvider>,
  )
}

describe('MessageAnalysis', () => {
  it('highlights per-message evidence and separates conversation-level escalation', () => {
    const { container } = renderAnalysis()

    expect(screen.getByRole('heading', { name: 'Conversation analysis' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Message 2' })).toBeInTheDocument()
    expect(screen.getByText('UPFRONT_PAYMENT')).toBeInTheDocument()
    expect(screen.getByText('ARTIFICIAL_URGENCY')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Escalation across the conversation' })).toBeInTheDocument()
    expect(screen.getByText('ESCALATING_PRESSURE')).toBeInTheDocument()

    expect(container.querySelectorAll('mark')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Call 1930' })).toHaveAttribute('href', 'tel:1930')
    expect(container.textContent).not.toMatch(/\bfake\b|\bgenuine\b/i)
  })

  it('never fabricates factors when the conversation has no signals', () => {
    renderAnalysis({
      id: 'conversation',
      risk_band: 'insufficient_information',
      risk_score: null,
      summary: 'Not enough information to assess this conversation.',
      risk_factors: [],
      recommendations: [],
      unknowns: [],
      missing_information: ['More conversation context (multiple messages) for escalation analysis'],
      notes: [],
    })

    expect(screen.getByText('No specific risk factors detected from the provided information.')).toBeInTheDocument()
    expect(screen.getByText('No numeric score: not enough information to assess reliably.')).toBeInTheDocument()
    expect(screen.getAllByText('No warning signs detected in this message.')).toHaveLength(2)
    expect(document.querySelectorAll('mark')).toHaveLength(0)
  })
})

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { AnalysisResult, RiskFactor } from '../lib/api'
import { RiskBand } from './ui/RiskBand'
import { Stamp } from './ui/Stamp'
import { buttonClass } from './ui/buttonStyles'
import { HighlightedText } from './HighlightedText'

type Message = { sender: string; text: string }
type Span = { start: number; end: number }

function factorMessageIndex(factor: RiskFactor): number | null {
  const type = factor.source?.type
  if (!type?.startsWith('message:')) return null
  const index = Number(type.split(':')[1])
  return Number.isInteger(index) && index >= 0 ? index : null
}

function FactorCard({ factor, index = 0 }: { factor: RiskFactor; index?: number }) {
  const { t } = useTranslation()
  return (
    <li className="entry pb-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-heading">{factor.code}</span>
          {factor.severity && (
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {t('analyze.message.severity', { value: factor.severity, defaultValue: 'Severity: {{value}}' })}
            </span>
          )}
          {factor.confidence && (
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
              {t('analyze.message.confidence', {
                value: factor.confidence,
                defaultValue: 'Confidence: {{value}}',
              })}
            </span>
          )}
        </div>
        <Stamp
          lines={[factor.severity || 'noted']}
          tone={factor.severity === 'high' ? 'stamp' : factor.severity === 'medium' ? 'warning' : 'muted'}
          animate
          delayMs={index * 80}
        />
      </div>
      {factor.explanation && <p className="mt-1.5 text-text">{factor.explanation}</p>}
      {factor.evidence?.excerpt && (
        <p className="mt-1.5 border-l-2 border-stamp bg-stamp/[0.06] px-2.5 py-1.5 text-muted">
          {t('analyze.message.excerpt', { text: factor.evidence.excerpt, defaultValue: 'Excerpt: {{text}}' })}
        </p>
      )}
    </li>
  )
}

/**
 * Renders a conversation analysis without implying a verdict.
 *
 * Every factor whose source is `message:<index>:<sender>` is attached to the
 * message that triggered it, and its evidence span is highlighted in place.
 * Conversation-level signals such as ESCALATING_PRESSURE get their own callout.
 */
export function MessageAnalysis({ messages, data }: { messages: Message[]; data: AnalysisResult }) {
  const { t } = useTranslation()
  const factors = useMemo(() => data.risk_factors || [], [data.risk_factors])

  const byMessage = useMemo(() => {
    const grouped = new Map<number, RiskFactor[]>()
    for (const factor of factors) {
      const index = factorMessageIndex(factor)
      if (index === null) continue
      grouped.set(index, [...(grouped.get(index) || []), factor])
    }
    return grouped
  }, [factors])

  const conversationFactors = factors.filter((factor) => factor.source?.type === 'conversation')
  const otherFactors = factors.filter(
    (factor) => factorMessageIndex(factor) === null && factor.source?.type !== 'conversation',
  )
  const recs = [...(data.recommendations || [])].sort((a, b) => (a.priority || 99) - (b.priority || 99))
  const has1930 = recs.some((recommendation) => recommendation.code === 'CONTACT_1930_IF_PAID')
  const unknowns = data.unknowns || []
  const missing = data.missing_information || []

  const title = t('analyze.message.resultTitle', { defaultValue: 'Conversation analysis' })

  return (
    <section
      aria-labelledby="message-analysis-heading"
      aria-live="polite"
      className="space-y-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="message-analysis-heading" className="font-display text-lg font-bold text-heading">
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {data.summary ||
              t('analyze.message.summaryFallback', {
                defaultValue: 'Conversation analyzed for warning signs and escalation patterns.',
              })}
          </p>
          <p className="mt-2 text-sm text-text">
            <strong>{t('analyze.message.decisionSupport', { defaultValue: 'Decision support, not a verdict.' })}</strong>{' '}
            {t('analyze.message.decisionSupportBody', {
              defaultValue:
                'This is a risk indicator based on the messages you provided, not a finding about any person or company.',
            })}
          </p>
        </div>
        <div className="text-right">
          <RiskBand band={data.risk_band} />
          {data.risk_band === 'insufficient_information' ? (
            <p className="mt-2 text-sm text-muted">
              {t('analyze.message.noScore', {
                defaultValue: 'No numeric score: not enough information to assess reliably.',
              })}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">
              {t('analyze.message.riskIndicator', {
                score: data.risk_score ?? '—',
                defaultValue: 'Risk indicator: {{score}} / 100',
              })}
            </p>
          )}
        </div>
      </div>

      <p className="border-l-2 border-cover bg-cover/[0.05] px-4 py-3 text-sm leading-relaxed text-muted">
        {t('analyze.message.highlightNote', {
          defaultValue:
            'Highlighted phrases triggered the factors listed under each message. Conversation text is treated as data, never as instructions.',
        })}
      </p>

      <section aria-labelledby="message-transcript-heading">
        <h3 id="message-transcript-heading" className="mb-2 font-display text-[15px] font-bold text-heading">
          {t('analyze.message.transcript', { defaultValue: 'Conversation with highlighted evidence' })}
        </h3>
        <ol className="space-y-3">
          {messages.map((message, index) => {
            const messageFactors = byMessage.get(index) || []
            const spans = messageFactors
              .map((factor) => factor.evidence?.span)
              .filter((span): span is Span => !!span && typeof span.start === 'number' && typeof span.end === 'number')
            return (
              <li key={index} className="entry pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium text-heading">
                    {t('analyze.message.messageN', { n: index + 1, defaultValue: 'Message {{n}}' })}
                  </h4>
                  <span className="border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                    {t('analyze.message.sender', { sender: message.sender, defaultValue: 'Sender: {{sender}}' })}
                  </span>
                </div>
                <div className="mt-2.5 border border-border bg-tint/30 p-3">
                  <HighlightedText text={message.text} spans={spans} />
                </div>
                {messageFactors.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    {t('analyze.message.noMessageFactors', { defaultValue: 'No warning signs detected in this message.' })}
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {messageFactors.map((factor, factorIndex) => (
                      <FactorCard key={factor.evidence_key || `${factor.code}-${factorIndex}`} factor={factor} index={factorIndex} />
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      {conversationFactors.length > 0 && (
        <section
          aria-labelledby="message-escalation-heading"
          role="note"
          className="border-l-2 border-warning bg-warning/10 p-4"
        >
          <h3 id="message-escalation-heading" className="font-display text-[15px] font-bold text-heading">
            {t('analyze.message.escalation', { defaultValue: 'Escalation across the conversation' })}
          </h3>
          <p className="mt-1 text-sm text-text">
            {t('analyze.message.escalationNote', {
              defaultValue:
                'A delayed payment request or rising pressure across messages is a signal for review, not proof of wrongdoing.',
            })}
          </p>
          <ul className="mt-2 space-y-2">
            {conversationFactors.map((factor, index) => (
              <FactorCard key={factor.evidence_key || `${factor.code}-${index}`} factor={factor} index={index} />
            ))}
          </ul>
        </section>
      )}

      {otherFactors.length > 0 && (
        <section aria-labelledby="message-other-heading">
          <h3 id="message-other-heading" className="mb-2 font-display text-[15px] font-bold text-heading">
            {t('analyze.message.otherFactors', { defaultValue: 'Other signals' })}
          </h3>
          <ul className="space-y-2">
            {otherFactors.map((factor, index) => (
              <FactorCard key={factor.evidence_key || `${factor.code}-${index}`} factor={factor} index={index} />
            ))}
          </ul>
        </section>
      )}

      {factors.length === 0 && (
        <p className="text-sm text-muted">
          {t('analyze.message.noFactors', {
            defaultValue: 'No specific risk factors detected from the provided information.',
          })}
        </p>
      )}

      <section aria-labelledby="message-recommendations-heading">
        <h3 id="message-recommendations-heading" className="mb-2 font-display text-[15px] font-bold text-heading">
          {t('analyze.message.recommendations', { defaultValue: 'Recommendations' })}
        </h3>
        {recs.length === 0 ? (
          <p className="text-sm text-muted">
            {t('analyze.message.noRecommendations', { defaultValue: 'No recommendations available.' })}
          </p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {recs.map((recommendation, index) => (
              <li key={recommendation.code || index}>
                <span className="font-medium">{recommendation.code}</span>
                {(recommendation.text || recommendation.text_key) && (
                  <span> — {recommendation.text || recommendation.text_key}</span>
                )}
              </li>
            ))}
          </ol>
        )}
        {has1930 && (
          <div className="mt-3 rounded-none border border-danger/30 bg-danger/10 p-3">
            <p className="font-medium text-heading">
              {t('analyze.message.cyberHelp', { defaultValue: 'If money was sent, act quickly' })}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="tel:1930" className={buttonClass('primary')}>
                {t('analyze.message.call1930', { defaultValue: 'Call 1930' })}
              </a>
              <a
                href="/help/cybercrime"
                className={buttonClass('secondary')}
              >
                {t('analyze.message.reportCyber', { defaultValue: 'Report Cybercrime' })}
              </a>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="message-unknowns-heading">
        <h3 id="message-unknowns-heading" className="mb-2 font-display text-[15px] font-bold text-heading">
          {t('analyze.message.unknowns', { defaultValue: 'Unknowns and missing information' })}
        </h3>
        {unknowns.length === 0 && missing.length === 0 ? (
          <p className="text-sm text-muted">
            {t('analyze.message.noUnknowns', { defaultValue: 'No additional unknowns reported.' })}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-1 font-medium text-heading">
                {t('analyze.message.unknownsLabel', { defaultValue: 'Unknowns' })}
              </h4>
              {unknowns.length === 0 ? (
                <p className="text-sm text-muted">{t('analyze.message.none', { defaultValue: 'None' })}</p>
              ) : (
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-text">
                  {unknowns.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="mb-1 font-medium text-heading">
                {t('analyze.message.missingLabel', { defaultValue: 'Missing information to verify' })}
              </h4>
              {missing.length === 0 ? (
                <p className="text-sm text-muted">{t('analyze.message.none', { defaultValue: 'None' })}</p>
              ) : (
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-text">
                  {missing.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </section>
  )
}

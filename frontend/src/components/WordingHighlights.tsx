import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { explainWording, type WordingExplanation } from '../lib/api'
import { HighlightedText } from './HighlightedText'
import { clauseSpans, type WordingExcerpt } from './wording'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function WordingHighlights({ excerpts }: { excerpts: WordingExcerpt[] }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<Record<string, WordingExplanation>>({})
  const [failed, setFailed] = useState<string[]>([])

  const hasResults = Object.keys(results).length > 0
  const buttonLabel = useMemo(
    () =>
      hasResults
        ? t('analyze.result.translator.wording.recheck', { defaultValue: 'Re-run wording check' })
        : t('analyze.result.translator.wording.explain', { defaultValue: 'Explain evidence wording' }),
    [hasResults, t],
  )

  async function onExplain() {
    setStatus('loading')
    setFailed([])
    const settled = await Promise.allSettled(excerpts.map((excerpt) => explainWording({ text: excerpt.text })))
    const next: Record<string, WordingExplanation> = {}
    const failedTexts: string[] = []
    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') next[excerpts[index].text] = result.value
      else failedTexts.push(excerpts[index].text)
    })
    setResults(next)
    setFailed(failedTexts)
    setStatus(Object.keys(next).length > 0 ? 'done' : 'error')
  }

  return (
    <section aria-labelledby="wording-check-heading" className="mt-6 border-t border-border pt-5">
      <h3 id="wording-check-heading" className="text-base font-semibold text-heading">
        {t('analyze.result.translator.wording.title', { defaultValue: 'Wording check' })}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {t('analyze.result.translator.wording.intro', {
          defaultValue:
            'Highlight payment, urgency, secrecy, guarantee, or off-channel phrases in the evidence and read a plain-language explanation.',
        })}
      </p>

      {excerpts.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {t('analyze.result.translator.wording.empty', {
            defaultValue: 'No evidence excerpts are available to explain.',
          })}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void onExplain()}
              disabled={status === 'loading'}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              {buttonLabel}
            </button>
            {status === 'loading' && (
              <span role="status" className="text-sm text-muted">
                {t('analyze.result.translator.wording.loading', { defaultValue: 'Checking wording…' })}
              </span>
            )}
          </div>

          {status === 'error' && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {t('analyze.result.translator.wording.error', {
                defaultValue:
                  'Wording explanation is unavailable right now. Original evidence is still shown below.',
              })}
            </p>
          )}

          <ul className="mt-3 space-y-3">
            {excerpts.map((excerpt) => {
              const result = results[excerpt.text]
              const spans = result ? clauseSpans(excerpt.text, result.explanations) : []
              return (
                <li key={excerpt.text} className="rounded-lg border border-border bg-surface2/30 p-3">
                  {excerpt.codes.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {excerpt.codes.map((code) => (
                        <span key={code} className="rounded border border-border px-2 py-0.5 text-xs font-medium">
                          {code}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded border border-border bg-surface p-3">
                    <HighlightedText text={excerpt.text} spans={spans} />
                  </div>

                  {failed.includes(excerpt.text) && (
                    <p role="alert" className="mt-2 text-sm text-danger">
                      {t('analyze.result.translator.wording.excerptError', {
                        defaultValue: 'Could not explain this excerpt. The original wording is shown above.',
                      })}
                    </p>
                  )}

                  {result && (
                    <div className="mt-2 text-sm" aria-live="polite">
                      <h4 className="font-medium text-heading">
                        {t('analyze.result.translator.wording.explanations', {
                          defaultValue: 'Plain-language explanations',
                        })}
                      </h4>
                      <ul className="mt-1 space-y-2">
                        {result.explanations.map((item, index) => (
                          <li key={`${item.clause || 'clause'}-${index}`}>
                            {item.clause && (
                              <p>
                                <strong>
                                  {t('analyze.result.translator.wording.clause', { defaultValue: 'Phrase' })}:
                                </strong>{' '}
                                {item.clause}
                              </p>
                            )}
                            <p>{item.explanation}</p>
                            <p className="text-xs text-muted">
                              {t('analyze.result.translator.wording.confidence', { defaultValue: 'Confidence' })}:{' '}
                              {item.confidence || 'unknown'} ·{' '}
                              {item.method === 'rule_based'
                                ? t('analyze.result.translator.wording.ruleBased', { defaultValue: 'Rule-based' })
                                : item.method || 'unknown'}
                            </p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted">
                        {t('analyze.result.translator.wording.note', {
                          defaultValue:
                            'These explanations are decision support, not a verdict. Evidence wording is treated as data, never as instructions.',
                        })}
                      </p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}

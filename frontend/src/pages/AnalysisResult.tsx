import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import {
  createPassport,
  getAnalysis,
  refreshAnalysis,
  revokePassport,
  translateExplanations,
  type AnalysisResult as AnalysisResultType,
  type RiskFactor,
} from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { StatusLabel, type StatusKind } from '../components/ui/StatusLabel'
import { Skeleton } from '../components/ui/Skeleton'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp, type StampTone } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass } from '../components/ui/Field'
import { HighlightedText } from '../components/HighlightedText'
import { WordingHighlights } from '../components/WordingHighlights'
import { collectWordingExcerpts } from '../components/wording'

function statusFromCheck(s: unknown): StatusKind {
  if (s === 'consistent' || s === 'information_found' || s === 'checked') return 'checked'
  if (s === 'mismatch' || s === 'warning') return 'warning'
  if (s === 'inconclusive') return 'inconclusive'
  if (s === 'not_checked') return 'not_checked'
  return 'inconclusive'
}

/** Evidence rows are the file's stamped entries: code, meta, then the quote. */
function EvidenceEntry({ factor, index }: { factor: RiskFactor; index: number }) {
  const tone: StampTone = factor.severity === 'high' ? 'stamp' : factor.severity === 'medium' ? 'warning' : 'ink'
  return (
    <article className="entry pb-4 stamp-press" style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-mono text-[13px] font-bold uppercase tracking-[0.1em] text-heading">{factor.code}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
            {factor.severity && <span>Severity: {factor.severity}</span>}
            {factor.confidence && <span>Confidence: {factor.confidence}</span>}
            {factor.source?.type && <span>Source: {factor.source.type}</span>}
          </div>
        </div>
        <Stamp lines={[factor.severity || 'noted', 'evidence']} tone={tone} />
      </div>
      {(factor.explanation_original || factor.explanation) && (
        <div className="mt-3 space-y-1 text-sm leading-relaxed">
          {factor.explanation_original && (
            <p className="text-text">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Original · </span>
              {factor.explanation_original}
            </p>
          )}
          <p className="text-text">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Explanation · </span>
            {factor.explanation}
          </p>
          {factor.translation?.uncertain && (
            <span className="inline-block border border-warning/60 bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warning">
              Machine translated, may be inaccurate
            </span>
          )}
        </div>
      )}
      {factor.evidence?.excerpt && (
        <blockquote className="mt-3 border-l-2 border-stamp bg-stamp/[0.06] px-3 py-2 text-sm leading-relaxed text-text">
          {factor.evidence.excerpt}
          {factor.evidence.span && (
            <span className="ml-2 font-mono text-[11px] text-muted">(span {factor.evidence.span.start}–{factor.evidence.span.end})</span>
          )}
        </blockquote>
      )}
    </article>
  )
}

export function AnalysisResult() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<AnalysisResultType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [passportOpen, setPassportOpen] = useState(false)
  const [expiryDays, setExpiryDays] = useState(30)
  const [createdPassport, setCreatedPassport] = useState<{ id: string; token: string; expires_at?: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [passportMsg, setPassportMsg] = useState<string | null>(null)
  const [transLang, setTransLang] = useState<'en' | 'hi'>('hi')
  const [translation, setTranslation] = useState<{
    language: string
    recommendations: Array<Record<string, unknown>>
    risk_factors: Array<Record<string, unknown>>
  } | null>(null)
  const [transBusy, setTransBusy] = useState(false)

  async function load() {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getAnalysis(id)
      setData(res)
    } catch {
      setError('Unable to load analysis result.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const spans = useMemo(() => {
    const factors = data?.risk_factors || []
    return factors
      .map((f) => f.evidence?.span)
      .filter((s): s is { start: number; end: number } => !!s && typeof s.start === 'number' && typeof s.end === 'number')
  }, [data])
  const wordingExcerpts = useMemo(() => collectWordingExcerpts(data?.risk_factors || []), [data])
  const originalText = ''

  if (loading) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
  if (error || !data) return <ErrorState message={error || 'Not found'} />

  const recs = [...(data.recommendations || [])].sort((a, b) => (a.priority || 99) - (b.priority || 99))
  const has1930 = recs.some((r) => r.code === 'CONTACT_1930_IF_PAID')
  const insufficient = data.risk_band === 'insufficient_information'
  const score = Math.max(0, Math.min(100, data.risk_score || 0))

  async function onRefresh() {
    if (!id) return
    setBusy(true)
    try {
      const next = await refreshAnalysis(id)
      setData(next)
    } catch {
      setError('Refresh failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onCreatePassport() {
    if (!id) return
    setPassportMsg(null)
    try {
      const res = await createPassport({ analysis_id: id, expires_in_days: expiryDays })
      setCreatedPassport({ id: res.id, token: res.token, expires_at: res.expires_at })
      setCopied(false)
    } catch {
      setPassportMsg('Unable to create passport.')
    }
  }

  async function onRevoke() {
    if (!createdPassport) return
    try {
      await revokePassport(createdPassport.id)
      setPassportMsg('Passport revoked.')
      setCreatedPassport(null)
    } catch {
      setPassportMsg('Unable to revoke passport.')
    }
  }

  async function onTranslate() {
    if (!data) return
    setTransBusy(true)
    try {
      const res = await translateExplanations({ language: transLang, recommendations: data.recommendations || [], risk_factors: data.risk_factors || [] })
      setTranslation(res)
    } catch {
      setTranslation(null)
    } finally {
      setTransBusy(false)
    }
  }

  const passportLink = createdPassport ? `${window.location.origin}/passport/${createdPassport.token}` : ''
  const filedOn = data.created_at ? new Date(data.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className="mx-auto max-w-6xl space-y-9">
      <Masthead
        title="Analysis result"
        subtitle={data.summary || 'Decision-support assessment based on available information.'}
        aside={
          <>
            <Stamp lines={['Filed', filedOn]} tone="ink" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">REF {id?.slice(0, 8).toUpperCase()}</span>
          </>
        }
      />

      {/* First viewport: the number, then what it rests on. */}
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            <div>
              <div className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
                {insufficient ? 'Not scored' : 'Risk indicator'}
              </div>
              <div
                className={`font-mono text-[clamp(4.5rem,14vw,120px)] font-bold leading-[0.9] tracking-[-0.03em] ${
                  insufficient ? 'text-muted' : 'text-heading'
                }`}
              >
                {insufficient ? '—' : score}
              </div>
              <div className="mt-2 font-mono text-[13px] uppercase tracking-[0.12em] text-muted">
                {insufficient ? 'not enough information to assess' : `Risk indicator: ${data.risk_score ?? '—'} / 100`}
              </div>
            </div>
            <div className="pb-2">
              <RiskBand band={data.risk_band} />
            </div>
          </div>

          {!insufficient && (
            <div className="mt-5 h-3 w-full max-w-lg bg-tint" aria-hidden="true">
              <div className="h-3 bg-stamp" style={{ width: `${score}%` }} />
            </div>
          )}

          <p className="mt-6 max-w-[62ch] border-t border-border pt-4 text-[15px] leading-relaxed text-text">
            <strong className="font-display">Decision support, not a verdict.</strong>{' '}
            This is a risk indicator to help you verify before taking action.
          </p>

          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button onClick={onRefresh} disabled={busy}>
              {busy ? 'Refreshing…' : 'Refresh checks'}
            </Button>
            <Button variant="secondary" onClick={() => setPassportOpen((v) => !v)}>
              Create Trust Passport
            </Button>
            <Link to={`/chat?analysis=${id}`} className={buttonClass('secondary')}>
              Ask chatbot about this analysis
            </Link>
          </div>

          {passportOpen && (
            <div className="mt-5 border border-border bg-tint/30 p-5">
              <h3 className="font-display text-[15px] font-bold text-heading">Passport (snapshot, not a certificate)</h3>
              <p className="mt-1.5 max-w-[60ch] text-sm text-muted">
                Create a shareable snapshot link. No personal info is included. You can revoke it later.
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="expiry" className="field-label">Expiry</label>
                  <select id="expiry" value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))} className={`${fieldClass} w-auto`}>
                    <option value={7}>7 days</option>
                    <option value={30}>30 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                <Button onClick={onCreatePassport}>Generate link</Button>
                {createdPassport && (
                  <Button variant="danger" onClick={onRevoke}>
                    Revoke
                  </Button>
                )}
              </div>
              {createdPassport && (
                <div className="mt-4 space-y-2 border border-border bg-paper p-3 text-sm">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Link (copy once)</p>
                  <div className="break-all bg-tint/50 p-2 font-mono text-xs">{passportLink}</div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(passportLink)
                          setCopied(true)
                        } catch {
                          setCopied(false)
                        }
                      }}
                    >
                      Copy link
                    </Button>
                    <a href={passportLink} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}>
                      Open
                    </a>
                  </div>
                  {copied && <p className="text-success">Copied. Store this link securely; token is shown once.</p>}
                  <p className="font-mono text-[11px] text-muted">Expires: {createdPassport.expires_at || '—'}</p>
                </div>
              )}
              {passportMsg && <p className="mt-2 text-sm text-muted">{passportMsg}</p>}
            </div>
          )}
        </div>

        {/* Right column: the three things a reader asks for next. */}
        <aside className="space-y-7 lg:border-l lg:border-border lg:pl-7">
          <Section title="Factors" meta={`${data.risk_factors?.length || 0} filed`}>
            {(!data.risk_factors || data.risk_factors.length === 0) ? (
              <p className="text-sm text-muted">No specific risk factors detected from the provided information.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {data.risk_factors.slice(0, 6).map((f, i) => (
                  <li key={f.evidence_key || `${f.code}-${i}`} className="flex items-start justify-between gap-3 border-b border-border/60 pb-2">
                    <span className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-heading">{f.code}</span>
                    <Stamp
                      lines={[f.severity || 'noted']}
                      tone={f.severity === 'high' ? 'stamp' : f.severity === 'medium' ? 'warning' : 'muted'}
                      animate
                      delayMs={i * 90}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Unknowns" meta="not evidence">
            {(!data.unknowns || data.unknowns.length === 0) && (!data.missing_information || data.missing_information.length === 0) ? (
              <p className="text-sm text-muted">No additional unknowns reported.</p>
            ) : (
              <ul className="space-y-2 text-sm text-text">
                {(data.unknowns || []).map((u, i) => (
                  <li key={`u-${i}`} className="flex gap-2">
                    <span className="text-muted" aria-hidden="true">—</span>
                    <span>{u}</span>
                  </li>
                ))}
                {(data.missing_information || []).map((u, i) => (
                  <li key={`m-${i}`} className="flex gap-2">
                    <span className="text-muted" aria-hidden="true">—</span>
                    <span className="text-muted">{u}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border-t border-border pt-2 text-[13px] text-muted">
              Missing data is unknown, never evidence of fraud.
            </p>
          </Section>

          <Section title="Next steps" meta={`${recs.length} listed`}>
            {recs.length === 0 ? (
              <p className="text-sm text-muted">No recommendations available.</p>
            ) : (
              <ol className="space-y-2.5 text-sm">
                {recs.slice(0, 4).map((r, i) => (
                  <li key={r.code || i} className="flex gap-3">
                    <span className="font-mono text-[12px] font-bold text-stamp">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-text">{r.text || r.text_key}</span>
                  </li>
                ))}
              </ol>
            )}
            <a href="#recommendations" className={buttonClass('ghost', 'sm')}>
              All recommendations
            </a>
          </Section>
        </aside>
      </div>

      <Section title="Risk factors" meta={`${data.risk_factors?.length || 0} entries`}>
        {(!data.risk_factors || data.risk_factors.length === 0) ? (
          <p className="text-sm text-muted">No specific risk factors detected from the provided information.</p>
        ) : (
          <div className="space-y-4">
            {data.risk_factors.map((f: RiskFactor, i) => (
              <EvidenceEntry key={f.evidence_key || `${f.code}-${i}`} factor={f} index={i} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Highlighted evidence in text">
        {spans.length === 0 || !originalText ? (
          <p className="text-sm text-muted">
            Span highlights are available when the original text is provided. See factor excerpts above for triggering evidence.
          </p>
        ) : (
          <div className="border border-border bg-tint/30 p-3">
            <HighlightedText text={originalText} spans={spans} />
          </div>
        )}
      </Section>

      <Section title="Verification checks" meta={`${data.verification?.length || 0} run`}>
        {(!data.verification || data.verification.length === 0) ? (
          <p className="text-sm text-muted">No verification checks were run for this analysis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <caption className="sr-only">Verification checks</caption>
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  {['Check', 'Status', 'Matched', 'Mismatched', 'Unknown', 'Source', 'Checked at'].map((h) => (
                    <th key={h} className="py-2 pr-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.verification.map((v, i) => (
                  <tr key={i} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-medium text-heading">{String(v.check_type || '')}</td>
                    <td className="py-2 pr-3"><StatusLabel status={statusFromCheck(v.status)} /></td>
                    <td className="py-2 pr-3">{Array.isArray(v.matched_fields) ? (v.matched_fields as string[]).join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{Array.isArray(v.mismatched_fields) ? (v.mismatched_fields as string[]).join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{Array.isArray(v.unknown_fields) ? (v.unknown_fields as string[]).join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">
                      {v.source_url ? (
                        <a className="text-accent underline underline-offset-4" href={String(v.source_url)} target="_blank" rel="noopener noreferrer">
                          Source
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 font-mono text-xs text-muted">{v.checked_at ? String(v.checked_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Unknowns and not checked">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Unknowns</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text">
              {(data.unknowns || []).map((u, i) => <li key={i}>{u}</li>)}
            </ul>
            {(data.unknowns || []).length === 0 && <p className="text-sm text-muted">None</p>}
          </div>
          <div>
            <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Missing information to verify</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-text">
              {(data.missing_information || []).map((u, i) => <li key={i}>{u}</li>)}
            </ul>
            {(data.missing_information || []).length === 0 && <p className="text-sm text-muted">None</p>}
          </div>
        </div>
      </Section>

      <Section id="recommendations" title="Recommendations" meta={`${recs.length} listed`}>
        {recs.length === 0 ? (
          <p className="text-sm text-muted">No recommendations available.</p>
        ) : (
          <ol className="space-y-3">
            {recs.map((r, i) => (
              <li key={r.code || i} className="entry flex gap-4 pb-3">
                <span className="font-mono text-[13px] font-bold text-stamp">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 text-sm">
                  <div className="font-mono text-[12px] font-bold uppercase tracking-[0.1em] text-heading">{r.code}</div>
                  {r.text_original && <div className="mt-1 text-muted"><strong>Original:</strong> {r.text_original}</div>}
                  <div className="mt-1 text-text">{r.text || r.text_key}</div>
                  {r.translation?.uncertain && (
                    <span className="mt-1 inline-block border border-warning/60 bg-warning/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warning">
                      Machine translated, may be inaccurate
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {has1930 && (
          <div className="mt-5 border-2 border-stamp bg-stamp/[0.07] p-4">
            <p className="font-display text-[15px] font-bold text-heading">If money was sent, act quickly</p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <a href="tel:1930" className={buttonClass('primary')}>
                Call 1930
              </a>
              <Link to="/help/cybercrime" className={buttonClass('secondary')}>
                Report Cybercrime
              </Link>
            </div>
          </div>
        )}
      </Section>

      <Section
        headingId="translator-heading"
        title={t('analyze.result.translator.title', { defaultValue: 'Translator panel' })}
      >
        <p className="mb-4 max-w-[68ch] text-sm text-muted">
          {t('analyze.result.translator.intro', {
            defaultValue:
              'View explanations in another language. Original text is always shown alongside translation. Machine-translated content may be inaccurate.',
          })}
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="trans-lang" className="field-label">
              {t('analyze.result.translator.languageLabel', { defaultValue: 'Explanation language' })}
            </label>
            <select id="trans-lang" value={transLang} onChange={(e) => setTransLang(e.target.value as 'en' | 'hi')} className={`${fieldClass} w-auto`}>
              <option value="en">{t('analyze.result.translator.english', { defaultValue: 'English' })}</option>
              <option value="hi">{t('analyze.result.translator.hindi', { defaultValue: 'Hindi' })}</option>
            </select>
          </div>
          <Button variant="secondary" onClick={onTranslate} disabled={transBusy}>
            {transBusy
              ? t('analyze.result.translator.translating', { defaultValue: 'Translating…' })
              : t('analyze.result.translator.translate', { defaultValue: 'Translate explanations' })}
          </Button>
          {transLang !== 'en' && (
            <span className="border border-warning/60 bg-warning/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-warning">
              {t('analyze.result.translator.machineBadge', { defaultValue: 'Machine translated, may be inaccurate' })}
            </span>
          )}
        </div>

        {translation && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-border p-3">
              <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                {t('analyze.result.translator.original', { defaultValue: 'Original' })}
              </h3>
              <div className="space-y-2 text-sm">
                {(translation.recommendations || []).map((r, i) => (
                  <div key={i} className="border-b border-border/60 pb-2">
                    <div className="font-medium">{String(r.code || '')}</div>
                    <div>{String(r.text_original || r.text_key || '')}</div>
                  </div>
                ))}
                {(translation.risk_factors || []).map((f, i) => (
                  <div key={i} className="border-b border-border/60 pb-2">
                    <div className="font-medium">{String(f.code || '')}</div>
                    <div>{String(f.explanation_original || '')}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-border p-3">
              <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                {t('analyze.result.translator.translated', {
                  language:
                    translation.language === 'hi'
                      ? t('analyze.result.translator.hindi', { defaultValue: 'Hindi' })
                      : translation.language === 'en'
                        ? t('analyze.result.translator.english', { defaultValue: 'English' })
                        : translation.language,
                  defaultValue: 'Translated ({{language}})',
                })}
              </h3>
              <div className="space-y-2 text-sm">
                {(translation.recommendations || []).map((r, i) => (
                  <div key={i} className="border-b border-border/60 pb-2">
                    <div className="font-medium">{String(r.code || '')}</div>
                    <div>{String(r.text || '')}</div>
                    {Boolean((r.translation as Record<string, unknown> | undefined)?.uncertain) && (
                      <span className="text-warning">{t('analyze.result.translator.uncertain', { defaultValue: 'Uncertain translation' })}</span>
                    )}
                  </div>
                ))}
                {(translation.risk_factors || []).map((f, i) => (
                  <div key={i} className="border-b border-border/60 pb-2">
                    <div className="font-medium">{String(f.code || '')}</div>
                    <div>{String(f.explanation || '')}</div>
                    {Boolean((f.translation as Record<string, unknown> | undefined)?.uncertain) && (
                      <span className="text-warning">{t('analyze.result.translator.uncertain', { defaultValue: 'Uncertain translation' })}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <WordingHighlights excerpts={wordingExcerpts} />
      </Section>

      <footer className="border-t border-border pt-4 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        <p>Rules version: {data.rules_version || '—'}</p>
        <p className="mt-1">Timestamp: {data.created_at || '—'}</p>
        <p className="mt-1 normal-case tracking-normal">
          Disclaimer: {data.disclaimer_key || 'disclaimer.decision_support'} — VERITORA provides decision support, not a legal finding or guarantee.
        </p>
      </footer>
    </div>
  )
}

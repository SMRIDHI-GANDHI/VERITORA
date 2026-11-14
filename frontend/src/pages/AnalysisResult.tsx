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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">Analysis result</h1>
            <p className="mt-1 text-muted">{data.summary || 'Decision-support assessment based on available information.'}</p>
            <p className="mt-2 text-sm text-text"><strong>Decision support, not a verdict.</strong> This is a risk indicator to help you verify before taking action.</p>
          </div>
          <div className="text-right">
            {data.risk_band === 'insufficient_information' ? (
              <div>
                <RiskBand band="insufficient_information" />
                <p className="mt-2 text-sm text-muted">No numeric score: not enough information to assess reliably.</p>
              </div>
            ) : (
              <div>
                <RiskBand band={data.risk_band} />
                <p className="mt-2 text-sm text-muted">Risk indicator: {data.risk_score ?? '—'} / 100</p>
                <div className="mt-2 h-2 w-48 overflow-hidden rounded bg-border" aria-hidden="true"><div className="h-full bg-caramel" style={{ width: `${Math.max(0, Math.min(100, data.risk_score || 0))}%` }} /></div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold text-heading">Risk factors</h2>
        {(!data.risk_factors || data.risk_factors.length === 0) ? (
          <p className="text-sm text-muted">No specific risk factors detected from the provided information.</p>
        ) : (
          <div className="space-y-3">
            {data.risk_factors.map((f: RiskFactor, i) => (
              <article key={f.evidence_key || `${f.code}-${i}`} className="rounded-lg border border-border bg-surface2/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-heading">{f.code}</span>
                  {f.severity && <span className="rounded border border-border px-2 py-0.5 text-xs">Severity: {f.severity}</span>}
                  {f.confidence && <span className="rounded border border-border px-2 py-0.5 text-xs">Confidence: {f.confidence}</span>}
                  {f.source?.type && <span className="rounded border border-border px-2 py-0.5 text-xs">Source: {f.source.type}</span>}
                </div>
                {(f.explanation_original || f.explanation) && (
                  <div className="mt-2 text-sm space-y-1">
                    {f.explanation_original && <p><strong>Original:</strong> {f.explanation_original}</p>}
                    <p><strong>Explanation:</strong> {f.explanation}</p>
                    {f.translation?.uncertain && <span className="inline-block rounded bg-warning/20 px-2 py-0.5 text-xs">Machine translated, may be inaccurate</span>}
                  </div>
                )}
                {f.evidence?.excerpt && (
                  <div className="mt-2 rounded border border-border bg-surface p-2 text-sm">
                    <span className="font-medium text-muted">Excerpt: </span>
                    <span>{f.evidence.excerpt}</span>
                    {f.evidence.span && <span className="ml-2 text-xs text-muted">(span {f.evidence.span.start}–{f.evidence.span.end})</span>}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-heading">Highlighted evidence in text</h2>
        {spans.length === 0 || !originalText ? (
          <p className="text-sm text-muted">Span highlights are available when the original text is provided. See factor excerpts above for triggering evidence.</p>
        ) : (
          <div className="rounded border border-border bg-surface2/30 p-3"><HighlightedText text={originalText} spans={spans} /></div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold text-heading">Verification checks</h2>
        {(!data.verification || data.verification.length === 0) ? (
          <p className="text-sm text-muted">No verification checks were run for this analysis.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted"><th className="py-2 pr-3">Check</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Matched</th><th className="py-2 pr-3">Mismatched</th><th className="py-2 pr-3">Unknown</th><th className="py-2 pr-3">Source</th><th className="py-2">Checked at</th></tr></thead>
              <tbody>
                {data.verification.map((v, i) => (
                  <tr key={i} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3 font-medium">{String(v.check_type || '')}</td>
                    <td className="py-2 pr-3"><StatusLabel status={statusFromCheck(v.status)} /></td>
                    <td className="py-2 pr-3">{Array.isArray(v.matched_fields) ? (v.matched_fields as string[]).join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{Array.isArray(v.mismatched_fields) ? (v.mismatched_fields as string[]).join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{Array.isArray(v.unknown_fields) ? (v.unknown_fields as string[]).join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{v.source_url ? <a className="text-accent underline" href={String(v.source_url)} target="_blank" rel="noopener noreferrer">Source</a> : '—'}</td>
                    <td className="py-2">{v.checked_at ? String(v.checked_at) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold text-heading">Unknowns and not checked</h2>
        {(!data.unknowns || data.unknowns.length === 0) && (!data.missing_information || data.missing_information.length === 0) ? (
          <p className="text-sm text-muted">No additional unknowns reported.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div><h3 className="mb-1 font-medium text-heading">Unknowns</h3><ul className="list-disc space-y-1 pl-5 text-sm">{(data.unknowns || []).map((u, i) => <li key={i}>{u}</li>)}</ul>{(data.unknowns || []).length === 0 && <p className="text-sm text-muted">None</p>}</div>
            <div><h3 className="mb-1 font-medium text-heading">Missing information to verify</h3><ul className="list-disc space-y-1 pl-5 text-sm">{(data.missing_information || []).map((u, i) => <li key={i}>{u}</li>)}</ul>{(data.missing_information || []).length === 0 && <p className="text-sm text-muted">None</p>}</div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold text-heading">Recommendations</h2>
        {recs.length === 0 ? <p className="text-sm text-muted">No recommendations available.</p> : (
          <ol className="list-decimal space-y-2 pl-5">
            {recs.map((r, i) => (
              <li key={r.code || i} className="text-sm">
                <div className="font-medium">{r.code}</div>
                {r.text_original && <div className="text-muted"><strong>Original:</strong> {r.text_original}</div>}
                <div>{r.text || r.text_key}</div>
                {r.translation?.uncertain && <span className="inline-block rounded bg-warning/20 px-2 py-0.5 text-xs">Machine translated, may be inaccurate</span>}
              </li>
            ))}
          </ol>
        )}
        {has1930 && (
          <div className="mt-4 rounded-lg border border-danger/30 bg-danger/10 p-3">
            <p className="font-medium text-heading">If money was sent, act quickly</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a href="tel:1930" className="rounded bg-caramel px-3 py-1.5 text-sm font-semibold text-buttonText">Call 1930</a>
              <Link to="/help/cybercrime" className="rounded border border-border bg-surface px-3 py-1.5 text-sm font-medium">Report Cybercrime</Link>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-3 text-lg font-semibold text-heading">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} disabled={busy} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium disabled:opacity-50">{busy ? 'Refreshing…' : 'Refresh checks'}</button>
          <button type="button" onClick={() => setPassportOpen((v) => !v)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">Create Trust Passport</button>
          <Link to={`/chat?analysis=${id}`} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium">Ask chatbot about this analysis</Link>
        </div>

        {passportOpen && (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-surface2/20 p-4">
            <h3 className="font-medium text-heading">Passport (snapshot, not a certificate)</h3>
            <p className="text-sm text-muted">Create a shareable snapshot link. No personal info is included. You can revoke it later.</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="expiry" className="mb-1 block text-sm font-medium">Expiry</label>
                <select id="expiry" value={expiryDays} onChange={(e) => setExpiryDays(Number(e.target.value))} className="rounded-lg border border-border bg-surface p-2.5">
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                </select>
              </div>
              <button type="button" onClick={onCreatePassport} className="rounded-lg bg-caramel px-4 py-2 font-semibold text-buttonText">Generate link</button>
              {createdPassport && <button type="button" onClick={onRevoke} className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger">Revoke</button>}
            </div>
            {createdPassport && (
              <div className="space-y-2 rounded border border-border bg-surface p-3 text-sm">
                <p><strong>Link (copy once):</strong></p>
                <div className="break-all rounded bg-surface2/30 p-2 font-mono text-xs">{passportLink}</div>
                <div className="flex gap-2">
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(passportLink); setCopied(true) } catch { setCopied(false) } }} className="rounded border border-border px-3 py-1.5">Copy link</button>
                  <a href={passportLink} target="_blank" rel="noopener noreferrer" className="rounded border border-border px-3 py-1.5">Open</a>
                </div>
                {copied && <p className="text-success">Copied. Store this link securely; token is shown once.</p>}
                <p className="text-xs text-muted">Expires: {createdPassport.expires_at || '—'}</p>
              </div>
            )}
            {passportMsg && <p className="text-sm text-muted">{passportMsg}</p>}
          </div>
        )}
      </section>

      <section aria-labelledby="translator-heading" className="rounded-xl border border-border bg-surface p-6">
        <h2 id="translator-heading" className="mb-3 text-lg font-semibold text-heading">
          {t('analyze.result.translator.title', { defaultValue: 'Translator panel' })}
        </h2>
        <p className="mb-3 text-sm text-muted">
          {t('analyze.result.translator.intro', {
            defaultValue:
              'View explanations in another language. Original text is always shown alongside translation. Machine-translated content may be inaccurate.',
          })}
        </p>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="trans-lang" className="mb-1 block text-sm font-medium">
              {t('analyze.result.translator.languageLabel', { defaultValue: 'Explanation language' })}
            </label>
            <select id="trans-lang" value={transLang} onChange={(e) => setTransLang(e.target.value as 'en' | 'hi')} className="rounded-lg border border-border bg-surface p-2.5">
              <option value="en">{t('analyze.result.translator.english', { defaultValue: 'English' })}</option>
              <option value="hi">{t('analyze.result.translator.hindi', { defaultValue: 'Hindi' })}</option>
            </select>
          </div>
          <button type="button" onClick={onTranslate} disabled={transBusy} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium disabled:opacity-50">
            {transBusy
              ? t('analyze.result.translator.translating', { defaultValue: 'Translating…' })
              : t('analyze.result.translator.translate', { defaultValue: 'Translate explanations' })}
          </button>
          {transLang !== 'en' && (
            <span className="rounded bg-warning/20 px-2 py-1 text-xs">
              {t('analyze.result.translator.machineBadge', { defaultValue: 'Machine translated, may be inaccurate' })}
            </span>
          )}
        </div>

        {translation && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-2 font-medium text-heading">
                {t('analyze.result.translator.original', { defaultValue: 'Original' })}
              </h3>
              <div className="space-y-2 text-sm">
                {(translation.recommendations || []).map((r, i) => (
                  <div key={i} className="border-b border-border/50 pb-2"><div className="font-medium">{String(r.code || '')}</div><div>{String(r.text_original || r.text_key || '')}</div></div>
                ))}
                {(translation.risk_factors || []).map((f, i) => (
                  <div key={i} className="border-b border-border/50 pb-2"><div className="font-medium">{String(f.code || '')}</div><div>{String(f.explanation_original || '')}</div></div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3">
              <h3 className="mb-2 font-medium text-heading">
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
                  <div key={i} className="border-b border-border/50 pb-2"><div className="font-medium">{String(r.code || '')}</div><div>{String(r.text || '')}</div>{Boolean((r.translation as Record<string, unknown> | undefined)?.uncertain) && <span className="text-xs text-warning">{t('analyze.result.translator.uncertain', { defaultValue: 'Uncertain translation' })}</span>}</div>
                ))}
                {(translation.risk_factors || []).map((f, i) => (
                  <div key={i} className="border-b border-border/50 pb-2"><div className="font-medium">{String(f.code || '')}</div><div>{String(f.explanation || '')}</div>{Boolean((f.translation as Record<string, unknown> | undefined)?.uncertain) && <span className="text-xs text-warning">{t('analyze.result.translator.uncertain', { defaultValue: 'Uncertain translation' })}</span>}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        <WordingHighlights excerpts={wordingExcerpts} />
      </section>

      <footer className="rounded-xl border border-border bg-surface p-4 text-xs text-muted">
        <p>Rules version: {data.rules_version || '—'}</p>
        <p>Timestamp: {data.created_at || '—'}</p>
        <p>Disclaimer: {data.disclaimer_key || 'disclaimer.decision_support'} — VERITORA provides decision support, not a legal finding or guarantee.</p>
      </footer>
    </div>
  )
}

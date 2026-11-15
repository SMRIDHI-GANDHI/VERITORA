import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnalysis, listAnalyses, refreshAnalysis, type AnalysisResult } from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { Stamp } from '../components/ui/Stamp'

function shortDate(v?: string) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

export function History() {
  const [items, setItems] = useState<AnalysisResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AnalysisResult | null>(null)
  const [original, setOriginal] = useState<AnalysisResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await listAnalyses()
      setItems(res.items || [])
    } catch {
      setError('Unable to load analysis history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadOriginal() {
      if (!selected?.supersedes_id) {
        setOriginal(null)
        return
      }
      try {
        const prev = await getAnalysis(String(selected.supersedes_id))
        if (!cancelled) setOriginal(prev)
      } catch {
        if (!cancelled) setOriginal(null)
      }
    }
    loadOriginal()
    return () => {
      cancelled = true
    }
  }, [selected])

  const comparison = useMemo(() => {
    if (!selected || !original) return null
    const changes: string[] = []
    if ((selected.risk_score ?? null) !== (original.risk_score ?? null)) changes.push(`Risk score: ${original.risk_score ?? '—'} → ${selected.risk_score ?? '—'}`)
    if (selected.risk_band !== original.risk_band) changes.push(`Risk band: ${original.risk_band} → ${selected.risk_band}`)
    if ((selected.rules_version || '') !== (original.rules_version || '')) changes.push(`Rules version: ${original.rules_version || '—'} → ${selected.rules_version || '—'}`)
    const sCodes = new Set((selected.risk_factors || []).map((f) => f.code))
    const oCodes = new Set((original.risk_factors || []).map((f) => f.code))
    const added = [...sCodes].filter((c) => !oCodes.has(c))
    const removed = [...oCodes].filter((c) => !sCodes.has(c))
    if (added.length) changes.push(`Factors added: ${added.join(', ')}`)
    if (removed.length) changes.push(`Factors removed: ${removed.join(', ')}`)
    if (changes.length === 0) changes.push('No major differences detected in score, band, rules version, or factor codes.')
    return changes
  }, [selected, original])

  async function onRefresh(id: string) {
    setBusy(true)
    try {
      const next = await refreshAnalysis(id)
      setItems((prev) => [next, ...prev.filter((i) => i.id !== next.id)])
      setSelected(next)
    } catch {
      setError('Refresh failed. Original posting may be unavailable.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <Masthead
        title="Analysis history"
        subtitle="Review past analyses and compare refreshed results with originals."
        aside={<Stamp lines={['Ledger', `${items.length} filed`]} tone="ink" />}
      />

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <div className="grid gap-x-9 gap-y-8 lg:grid-cols-[1fr_1.2fr]">
          <Section title="History" meta={`${items.length} filed`}>
            {items.length === 0 ? (
              <p className="text-sm text-muted">No analyses yet.</p>
            ) : (
              <ul>
                {items.map((a) => (
                  <li key={a.id} className="border-b border-border/60">
                    <button
                      type="button"
                      onClick={() => setSelected(a)}
                      aria-pressed={selected?.id === a.id}
                      className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-2 py-3 text-left transition-colors ${
                        selected?.id === a.id ? 'bg-tint/70 shadow-[inset_3px_0_0_0_var(--color-stamp)]' : 'hover:bg-tint/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-xs font-bold tracking-[0.08em] text-heading">{a.id.slice(0, 8)}…</span>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{shortDate(a.created_at)}</div>
                        {a.supersedes_id && (
                          <div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                            Refreshed (supersedes {String(a.supersedes_id).slice(0, 8)}…)
                          </div>
                        )}
                      </div>
                      <RiskBand band={a.risk_band} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Detail & comparison" meta={selected ? selected.id.slice(0, 8).toUpperCase() : 'none selected'}>
            {!selected ? (
              <p className="text-sm text-muted">Select an analysis to view details.</p>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap gap-2.5">
                  <Link to={`/analysis/${selected.id}`} className={buttonClass('secondary')}>
                    Open full result
                  </Link>
                  <Button onClick={() => onRefresh(selected.id)} disabled={busy}>
                    {busy ? 'Refreshing…' : 'Refresh checks'}
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border border-border p-3.5 text-sm">
                    <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Selected</h3>
                    <div className="space-y-1 text-text">
                      <div><strong className="font-display">ID:</strong> <span className="font-mono text-xs">{selected.id}</span></div>
                      <div><strong className="font-display">Created:</strong> {shortDate(selected.created_at)}</div>
                      <div><strong className="font-display">Band:</strong> {selected.risk_band}</div>
                      <div><strong className="font-display">Score:</strong> {selected.risk_score ?? '—'}</div>
                      <div><strong className="font-display">Rules:</strong> {selected.rules_version || '—'}</div>
                    </div>
                  </div>
                  <div className="border border-border p-3.5 text-sm">
                    <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Original (if refreshed)</h3>
                    {selected.supersedes_id ? (
                      original ? (
                        <div className="space-y-1 text-text">
                          <div><strong className="font-display">ID:</strong> <span className="font-mono text-xs">{original.id}</span></div>
                          <div><strong className="font-display">Created:</strong> {shortDate(original.created_at)}</div>
                          <div><strong className="font-display">Band:</strong> {original.risk_band}</div>
                          <div><strong className="font-display">Score:</strong> {original.risk_score ?? '—'}</div>
                          <div><strong className="font-display">Rules:</strong> {original.rules_version || '—'}</div>
                        </div>
                      ) : (
                        <p className="text-muted">Original could not be loaded.</p>
                      )
                    ) : (
                      <p className="text-muted">This analysis is not a refresh.</p>
                    )}
                  </div>
                </div>
                {comparison && (
                  <div className="border-l-2 border-stamp bg-stamp/[0.06] p-3.5">
                    <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">What changed</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text">
                      {comparison.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  )
}

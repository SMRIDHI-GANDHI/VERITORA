import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAnalysis, listAnalyses, refreshAnalysis, type AnalysisResult } from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

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
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Analysis history</h1>
        <p className="mt-2 text-muted">Review past analyses and compare refreshed results with originals.</p>
      </div>

      {loading ? <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : error ? <ErrorState message={error} /> : (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold text-heading">History</h2>
            {items.length === 0 ? <p className="text-sm text-muted">No analyses yet.</p> : (
              <ul className="space-y-2">
                {items.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setSelected(a)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === a.id ? 'border-caramel bg-caramel/10' : 'border-border'}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted">{a.id.slice(0, 8)}…</span>
                        <RiskBand band={a.risk_band} />
                      </div>
                      <div className="mt-1 text-sm text-muted">{shortDate(a.created_at)}</div>
                      {a.supersedes_id && <div className="mt-1 text-xs text-muted">Refreshed (supersedes {String(a.supersedes_id).slice(0, 8)}…)</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
            <h2 className="text-lg font-semibold text-heading">Detail & comparison</h2>
            {!selected ? <p className="text-sm text-muted">Select an analysis to view details.</p> : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/analysis/${selected.id}`} className="rounded-lg border border-border px-3 py-2 text-sm">Open full result</Link>
                  <button type="button" onClick={() => onRefresh(selected.id)} disabled={busy} className="rounded-lg bg-caramel px-3 py-2 text-sm font-semibold text-buttonText disabled:opacity-50">{busy ? 'Refreshing…' : 'Refresh checks'}</button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <h3 className="font-medium text-heading">Selected</h3>
                    <div><strong>ID:</strong> <span className="font-mono text-xs">{selected.id}</span></div>
                    <div><strong>Created:</strong> {shortDate(selected.created_at)}</div>
                    <div><strong>Band:</strong> {selected.risk_band}</div>
                    <div><strong>Score:</strong> {selected.risk_score ?? '—'}</div>
                    <div><strong>Rules:</strong> {selected.rules_version || '—'}</div>
                  </div>
                  <div className="rounded-lg border border-border p-3 text-sm">
                    <h3 className="font-medium text-heading">Original (if refreshed)</h3>
                    {selected.supersedes_id ? (
                      original ? (
                        <>
                          <div><strong>ID:</strong> <span className="font-mono text-xs">{original.id}</span></div>
                          <div><strong>Created:</strong> {shortDate(original.created_at)}</div>
                          <div><strong>Band:</strong> {original.risk_band}</div>
                          <div><strong>Score:</strong> {original.risk_score ?? '—'}</div>
                          <div><strong>Rules:</strong> {original.rules_version || '—'}</div>
                        </>
                      ) : <p className="text-muted">Original could not be loaded.</p>
                    ) : <p className="text-muted">This analysis is not a refresh.</p>}
                  </div>
                </div>
                {comparison && (
                  <div className="rounded-lg border border-border bg-surface2/20 p-3">
                    <h3 className="mb-2 font-medium text-heading">What changed</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {comparison.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

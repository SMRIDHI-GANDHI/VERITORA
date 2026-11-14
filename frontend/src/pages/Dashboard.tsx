import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChecklist, getDashboard, listSaved, type ChecklistItem, type SavedOpportunity } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskBand } from '../components/ui/RiskBand'

type DashboardData = {
  totals?: { analyses?: number; reports?: number; saved_opportunities?: number }
  risk_band_distribution?: Record<string, number>
  recent_analyses?: Array<{ id: string; risk_band: string; created_at?: string | null }>
  report_statuses?: Array<{ id: string; moderation_status?: string | null }>
  checklist_progress?: { completed?: number; total?: number }
}

const BANDS = ['lower', 'moderate', 'high_concern', 'very_high_concern', 'insufficient_information'] as const

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardData | null>(null)
  const [saved, setSaved] = useState<SavedOpportunity[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, s, c] = await Promise.all([getDashboard(), listSaved().catch(() => ({ items: [] })), getChecklist().catch(() => ({ items: [] }))])
      setData(d as DashboardData)
      setSaved((s as { items: SavedOpportunity[] }).items || [])
      setChecklist((c as { items: ChecklistItem[] }).items || [])
    } catch {
      setError('Could not load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const bandDist = useMemo(() => {
    const raw = data?.risk_band_distribution || {}
    return BANDS.map((b) => ({ band: b, count: Number(raw[b] || 0) }))
  }, [data])

  const totalBands = bandDist.reduce((a, b) => a + b.count, 0)
  const recent = data?.recent_analyses || []
  const reports = data?.report_statuses || []
  const completedChecklist = checklist.filter((i) => i.completed).length

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-heading">Dashboard</h1>
        <p className="mt-2 text-muted">Your verification workspace and recent activity.</p>
      </div>

      {loading && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28 w-full" />)}</div>}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-surface p-4"><div className="text-sm text-muted">Total analyses</div><div className="mt-1 text-2xl font-bold text-heading">{data?.totals?.analyses ?? 0}</div></div>
            <div className="rounded-lg border border-border bg-surface p-4"><div className="text-sm text-muted">Reports</div><div className="mt-1 text-2xl font-bold text-heading">{data?.totals?.reports ?? 0}</div></div>
            <div className="rounded-lg border border-border bg-surface p-4"><div className="text-sm text-muted">Saved opportunities</div><div className="mt-1 text-2xl font-bold text-heading">{saved.length || (data?.totals?.saved_opportunities ?? 0)}</div></div>
            <div className="rounded-lg border border-border bg-surface p-4"><div className="text-sm text-muted">Checklist progress</div><div className="mt-1 text-2xl font-bold text-heading">{completedChecklist}/{checklist.length || data?.checklist_progress?.total || 0}</div></div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-lg font-semibold text-heading">Risk band distribution</h2>
              <p className="mb-3 text-xs text-muted">Accessible chart with data table. Bars include labels (not color-only).</p>
              <div className="space-y-2" role="img" aria-label="Risk band distribution chart">
                {bandDist.map((b) => {
                  const pct = totalBands ? Math.round((b.count / totalBands) * 100) : 0
                  return (
                    <div key={b.band}>
                      <div className="mb-1 flex justify-between text-sm"><span className="capitalize">{b.band.replace(/_/g, ' ')}</span><span>{b.count} ({pct}%)</span></div>
                      <div className="h-3 w-full rounded bg-border"><div className="h-3 rounded bg-caramel" style={{ width: `${pct}%` }} /></div>
                    </div>
                  )
                })}
              </div>
              <table className="mt-4 w-full text-sm">
                <caption className="sr-only">Risk band distribution data</caption>
                <thead><tr className="border-b border-border text-left text-muted"><th className="py-1">Band</th><th className="py-1">Count</th><th className="py-1">Percent</th></tr></thead>
                <tbody>{bandDist.map((b) => <tr key={b.band} className="border-b border-border/50"><td className="py-1 capitalize">{b.band.replace(/_/g, ' ')}</td><td className="py-1">{b.count}</td><td className="py-1">{totalBands ? Math.round((b.count / totalBands) * 100) : 0}%</td></tr>)}</tbody>
              </table>
            </section>

            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-lg font-semibold text-heading">Analyses over time (recent)</h2>
              <p className="mb-3 text-xs text-muted">Based on recent analyses returned by the API (accessible list/table).</p>
              {recent.length === 0 ? <p className="text-sm text-muted">No analyses yet.</p> : (
                <table className="w-full text-sm">
                  <caption className="sr-only">Recent analyses</caption>
                  <thead><tr className="border-b border-border text-left text-muted"><th className="py-1">Analysis</th><th className="py-1">Band</th><th className="py-1">Created</th></tr></thead>
                  <tbody>
                    {recent.map((a) => (
                      <tr key={a.id} className="border-b border-border/50">
                        <td className="py-1"><Link className="text-accent underline" to={`/analysis/${a.id}`}>{a.id.slice(0, 8)}…</Link></td>
                        <td className="py-1"><RiskBand band={a.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} /></td>
                        <td className="py-1">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-lg font-semibold text-heading">Recent assessments</h2>
              {recent.length === 0 ? <p className="text-sm text-muted">No recent assessments.</p> : (
                <ul className="space-y-2 text-sm">{recent.map((a) => <li key={a.id} className="flex items-center justify-between gap-2"><Link className="text-accent underline" to={`/analysis/${a.id}`}>{a.id.slice(0, 8)}…</Link><RiskBand band={a.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} /></li>)}</ul>
              )}
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-lg font-semibold text-heading">Saved opportunities</h2>
              {saved.length === 0 ? <p className="text-sm text-muted">No saved opportunities yet.</p> : (
                <ul className="space-y-2 text-sm">{saved.slice(0, 5).map((s) => <li key={s.id} className="rounded border border-border p-2"><div className="font-medium">{s.title || 'Untitled'}</div>{s.analysis_id && <Link className="text-accent underline" to={`/analysis/${s.analysis_id}`}>View analysis</Link>}</li>)}</ul>
              )}
              <Link to="/saved" className="mt-3 inline-block text-sm text-accent underline">Manage saved</Link>
            </section>
            <section className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-lg font-semibold text-heading">Report statuses</h2>
              {reports.length === 0 ? <p className="text-sm text-muted">No reports yet.</p> : (
                <ul className="space-y-1 text-sm">{reports.map((r) => <li key={r.id} className="flex justify-between gap-2"><span className="font-mono text-xs">{r.id.slice(0, 8)}…</span><span className="capitalize">{(r.moderation_status || 'unknown').replace(/_/g, ' ')}</span></li>)}</ul>
              )}
              <div className="mt-4">
                <h3 className="font-medium text-heading">Checklist progress</h3>
                <p className="text-sm text-muted">{completedChecklist} completed of {checklist.length || data?.checklist_progress?.total || 0} items.</p>
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  )
}

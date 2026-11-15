import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getChecklist, getDashboard, listSaved, type ChecklistItem, type SavedOpportunity } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { RiskBand } from '../components/ui/RiskBand'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Icon } from '../components/ui/Icon'

type DashboardData = {
  totals?: { analyses?: number; reports?: number; saved_opportunities?: number }
  risk_band_distribution?: Record<string, number>
  recent_analyses?: Array<{ id: string; risk_band: string; created_at?: string | null }>
  report_statuses?: Array<{ id: string; moderation_status?: string | null }>
  checklist_progress?: { completed?: number; total?: number }
}

const BANDS = ['lower', 'moderate', 'high_concern', 'very_high_concern', 'insufficient_information'] as const

/** One line of the ledger: a label, a large figure, and a hairline under it. */
function LedgerLine({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="border-b border-border pb-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
        <span className="font-display text-[26px] leading-none text-heading">{value}</span>
      </div>
      {note && <p className="mt-1.5 text-[13px] text-muted">{note}</p>}
    </div>
  )
}

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

  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="space-y-8">
      <Masthead
        title="Dashboard"
        subtitle="Your verification workspace and recent activity."
        aside={<Stamp lines={['Dated', today]} tone="ink" />}
      />

      {loading && <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && (
        <>
          <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <LedgerLine label="Total analyses" value={data?.totals?.analyses ?? 0} />
            <LedgerLine label="Reports" value={data?.totals?.reports ?? 0} />
            <LedgerLine label="Saved opportunities" value={saved.length || (data?.totals?.saved_opportunities ?? 0)} />
            <LedgerLine
              label="Checklist progress"
              value={`${completedChecklist}/${checklist.length || data?.checklist_progress?.total || 0}`}
            />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <Section title="Risk band distribution" meta={`${totalBands} filed`}>
              <div className="space-y-2.5" role="img" aria-label="Risk band distribution chart">
                {bandDist.map((b) => {
                  const pct = totalBands ? Math.round((b.count / totalBands) * 100) : 0
                  return (
                    <div key={b.band}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="capitalize text-text">{b.band.replace(/_/g, ' ')}</span>
                        <span className="font-mono text-xs text-muted">{b.count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 w-full bg-tint">
                        <div className="h-2.5 bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <table className="mt-5 w-full text-sm">
                <caption className="sr-only">Risk band distribution data</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th className="py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Band</th>
                    <th className="py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Count</th>
                    <th className="py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {bandDist.map((b) => (
                    <tr key={b.band} className="border-b border-border/60">
                      <td className="py-1.5 capitalize">{b.band.replace(/_/g, ' ')}</td>
                      <td className="py-1.5 font-mono">{b.count}</td>
                      <td className="py-1.5 font-mono">{totalBands ? Math.round((b.count / totalBands) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title="Analyses over time" meta="recent">
              <p className="mb-3 text-[13px] text-muted">Based on recent analyses returned by the API.</p>
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No analyses yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <caption className="sr-only">Recent analyses</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Analysis</th>
                      <th className="py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Band</th>
                      <th className="py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((a) => (
                      <tr key={a.id} className="border-b border-border/60">
                        <td className="py-1.5">
                          <Link className="text-accent underline underline-offset-4" to={`/analysis/${a.id}`}>
                            {a.id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="py-1.5">
                          <RiskBand band={a.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} />
                        </td>
                        <td className="py-1.5 font-mono text-xs text-muted">{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Section>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            <Section title="Recent assessments">
              {recent.length === 0 ? (
                <p className="text-sm text-muted">No recent assessments.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {recent.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                      <Link className="text-accent underline underline-offset-4" to={`/analysis/${a.id}`}>
                        {a.id.slice(0, 8)}…
                      </Link>
                      <RiskBand band={a.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section
              title="Saved opportunities"
              action={
                <Link to="/saved" className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-accent underline underline-offset-4">
                  Manage
                </Link>
              }
            >
              {saved.length === 0 ? (
                <p className="text-sm text-muted">No saved opportunities yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {saved.slice(0, 5).map((s) => (
                    <li key={s.id} className="entry pb-3">
                      <div className="font-medium text-heading">{s.title || 'Untitled'}</div>
                      {s.analysis_id && (
                        <Link className="text-accent underline underline-offset-4" to={`/analysis/${s.analysis_id}`}>
                          View analysis
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Reports and checklist">
              {reports.length === 0 ? (
                <p className="text-sm text-muted">No reports yet.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {reports.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5">
                      <span className="font-mono text-xs text-muted">{r.id.slice(0, 8)}…</span>
                      <span className="capitalize">{(r.moderation_status || 'unknown').replace(/_/g, ' ')}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 border-t border-border pt-3">
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  <Icon name="checked" size={14} aria-hidden="true" />
                  Checklist
                </div>
                <p className="mt-2 text-sm text-text">
                  {completedChecklist} completed of {checklist.length || data?.checklist_progress?.total || 0} items.
                </p>
              </div>
            </Section>
          </div>
        </>
      )}
    </div>
  )
}

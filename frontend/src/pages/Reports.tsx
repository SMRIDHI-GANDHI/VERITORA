import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublicReports, type ReportPublic } from '../lib/api'
import { StatusLabel } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

export function Reports() {
  const [items, setItems] = useState<ReportPublic[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  async function load(company?: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await listPublicReports(company?.trim() || undefined)
      setItems(res.items || [])
    } catch {
      setError('Unable to load community reports.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = q
    ? items.filter((r) => [r.company, r.category, r.public_summary || ''].join(' ').toLowerCase().includes(q.toLowerCase()))
    : items

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-heading">Community Reports</h1>
          <p className="mt-2 text-muted">
            Approved, moderated user-submitted reports. These are allegations/experiences shared by users, not confirmed findings.
          </p>
        </div>
        <Link to="/reports/new" className="rounded-lg bg-caramel px-4 py-2 font-semibold text-buttonText">
          Submit a report
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <label htmlFor="report-search" className="mb-1 block text-sm font-medium text-heading">Search approved reports</label>
        <input
          id="report-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface p-2.5"
          placeholder="Search by company, category, or summary"
        />
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">No approved reports to show.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <article key={r.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-heading">{r.company}</h2>
                <span className="rounded border border-border px-2 py-0.5 text-xs">user-submitted report</span>
                <StatusLabel status={r.moderation_status === 'substantiated' ? 'checked' : r.moderation_status === 'inconclusive' ? 'inconclusive' : 'under_review'} />
              </div>
              <p className="mt-1 text-sm text-muted">Category: {r.category}{r.occurred_on_approx ? ` • Approx. date: ${r.occurred_on_approx}` : ''}</p>
              <p className="mt-3 text-sm">{r.public_summary || 'No public summary available.'}</p>
              <p className="mt-3 text-xs text-muted">Moderation status: {r.moderation_status}. This is not a confirmed fact or legal finding.</p>
            </article>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-lg font-semibold text-heading">My reports & ratings</h2>
        <p className="mt-2 text-sm text-muted">
          Viewing and managing your submitted reports (status timeline, edit, appeal, delete request) requires account-linked report history from the API.
          If unavailable, submit a new report above; you will receive a submission status on creation.
        </p>
      </section>
    </div>
  )
}
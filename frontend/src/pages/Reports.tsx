import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listPublicReports, type ReportPublic } from '../lib/api'
import { StatusLabel } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'

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
    <div className="mx-auto max-w-5xl space-y-8">
      <Masthead
        title="Community Reports"
        subtitle="Approved, moderated user-submitted reports. These are allegations/experiences shared by users, not confirmed findings."
        aside={
          <>
            <Stamp lines={['Moderated', 'approved only']} tone="ink" />
            <Link to="/reports/new" className={buttonClass('primary')}>
              Submit a report
            </Link>
          </>
        }
      />

      <div>
        <label htmlFor="report-search" className={fieldLabelClass}>Search approved reports</label>
        <input
          id="report-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={fieldClass}
          placeholder="Search by company, category, or summary"
        />
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border bg-tint/30 p-6 text-sm text-muted">No approved reports to show.</div>
      ) : (
        <div>
          {filtered.map((r) => (
            <article key={r.id} className="entry pb-5">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-lg font-bold text-heading">{r.company}</h2>
                <span className="border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                  user-submitted report
                </span>
                <StatusLabel status={r.moderation_status === 'substantiated' ? 'checked' : r.moderation_status === 'inconclusive' ? 'inconclusive' : 'under_review'} />
              </div>
              <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                Category: {r.category}{r.occurred_on_approx ? ` • Approx. date: ${r.occurred_on_approx}` : ''}
              </p>
              <p className="mt-3 max-w-[70ch] text-sm leading-relaxed text-text">{r.public_summary || 'No public summary available.'}</p>
              <p className="mt-2.5 text-xs text-muted">Moderation status: {r.moderation_status}. This is not a confirmed fact or legal finding.</p>
            </article>
          ))}
        </div>
      )}

      <Section title={'My reports & ratings'} meta="account">
        <p className="max-w-[68ch] text-sm leading-relaxed text-muted">
          Viewing and managing your submitted reports (status timeline, edit, appeal, delete request) requires
          account-linked report history from the API. If unavailable, submit a new report above; you will receive a
          submission status on creation.
        </p>
      </Section>
    </div>
  )
}

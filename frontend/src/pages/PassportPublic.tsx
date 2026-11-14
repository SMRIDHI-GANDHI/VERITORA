import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPassportPublic, type PassportSnapshot } from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { Skeleton } from '../components/ui/Skeleton'

export function PassportPublic() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PassportSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!token) { setUnavailable(true); setLoading(false); return }
      try {
        const res = await getPassportPublic(token)
        if (mounted) setData(res)
      } catch {
        if (mounted) setUnavailable(true)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [token])

  if (loading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-40 w-full" /></div>

  if (unavailable || !data) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold text-heading">Trust Passport unavailable</h1>
        <p className="mt-2 text-muted">This passport link is unavailable, expired, revoked, or invalid. Passports are snapshots and may be refreshed by the owner.</p>
      </div>
    )
  }

  const checks = (data.checks_performed_and_not_performed || data.checks || []) as Array<Record<string, unknown>>
  const factors = (data.risk_factors || []) as Array<Record<string, unknown>>
  const recs = (data.recommendations || []) as Array<Record<string, unknown>>

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <style>{`@media print { header, footer, .no-print { display: none !important; } body { background: white; } .print-surface { border: 1px solid #ddd !important; } }`}</style>
      <div className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
        <strong>Snapshot, not a certificate.</strong> This Trust Passport is a time-limited snapshot for decision support. It is not a legal finding, verification guarantee, or verdict.
      </div>

      <section className="print-surface rounded-xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-heading">Trust Passport</h1>
            <p className="mt-1 text-muted">{String(data.summary || 'Decision-support snapshot')}</p>
          </div>
          <div className="text-right">
            {data.risk_band && <RiskBand band={data.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} />}
            {data.risk_score != null && <p className="mt-1 text-sm text-muted">Risk indicator: {String(data.risk_score)}/100</p>}
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div><strong>Rules version:</strong> {String(data.rules_version || '—')}</div>
          <div><strong>Analysis created:</strong> {String(data.analysis_created_at || '—')}</div>
          <div><strong>Passport expires:</strong> {String(data.expires_at || '—')}</div>
          <div><strong>Disclaimer:</strong> {String(data.disclaimer_key || 'disclaimer.decision_support')}</div>
        </div>
        <p className="mt-3 text-sm text-muted">{String(data.refresh_guidance || '')}</p>
      </section>

      <section className="print-surface rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-heading">Checks performed and not performed</h2>
        {checks.length === 0 ? <p className="text-sm text-muted">No check information available.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead><tr className="border-b border-border text-left text-muted"><th className="py-2 pr-3">Check</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Matched</th><th className="py-2 pr-3">Mismatched</th><th className="py-2 pr-3">Unknown</th><th className="py-2">Checked at</th></tr></thead>
              <tbody>
                {checks.map((c, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2 pr-3">{String(c.check_type || '')}</td>
                    <td className="py-2 pr-3">{String(c.status || '')}</td>
                    <td className="py-2 pr-3">{Array.isArray(c.matched_fields) ? c.matched_fields.join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{Array.isArray(c.mismatched_fields) ? c.mismatched_fields.join(', ') || '—' : '—'}</td>
                    <td className="py-2 pr-3">{Array.isArray(c.unknown_fields) ? c.unknown_fields.join(', ') || '—' : '—'}</td>
                    <td className="py-2">{String(c.checked_at || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="print-surface rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-heading">Risk factors</h2>
        {factors.length === 0 ? <p className="text-sm text-muted">No risk factors recorded.</p> : (
          <ul className="space-y-2">{factors.map((f, i) => <li key={i} className="rounded border border-border p-3 text-sm"><div className="font-medium">{String(f.code || '')}</div><div>{String(f.explanation || '')}</div></li>)}</ul>
        )}
      </section>

      <section className="print-surface rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-heading">Recommendations</h2>
        {recs.length === 0 ? <p className="text-sm text-muted">No recommendations recorded.</p> : (
          <ul className="list-disc space-y-1 pl-5 text-sm">{recs.map((r, i) => <li key={i}>{String(r.code || '')}{r.text_key ? ` — ${String(r.text_key)}` : ''}</li>)}</ul>
        )}
      </section>

      <section className="print-surface rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-2 text-lg font-semibold text-heading">Community summary</h2>
        <p className="text-sm text-muted">{String((data.community as Record<string, unknown> | undefined)?.note || 'User-submitted; not verified facts.')}</p>
        <p className="mt-1 text-sm">Approved report count: {String((data.community as Record<string, unknown> | undefined)?.approved_report_count ?? 0)}</p>
      </section>

      <p className="text-xs text-muted">No personal information is included in this passport.</p>
    </div>
  )
}

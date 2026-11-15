import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getPassportPublic, type PassportSnapshot } from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Icon } from '../components/ui/Icon'

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
      <div className="mx-auto max-w-3xl space-y-5">
        <Masthead title="Trust Passport unavailable" aside={<Stamp lines={['No file', 'link']} tone="muted" />} />
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted">
          This passport link is unavailable, expired, revoked, or invalid. Passports are snapshots and may be refreshed
          by the owner.
        </p>
      </div>
    )
  }

  const checks = (data.checks_performed_and_not_performed || data.checks || []) as Array<Record<string, unknown>>
  const factors = (data.risk_factors || []) as Array<Record<string, unknown>>
  const recs = (data.recommendations || []) as Array<Record<string, unknown>>
  const expires = String(data.expires_at || '—')

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <style>{`@media print { header, footer, .no-print { display: none !important; } body { background: white; } .print-surface { border: 1px solid #ddd !important; } }`}</style>

      <p className="flex items-start gap-3 border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
        <Icon name="info" size={16} className="mt-0.5 shrink-0 text-warning" />
        <span>
          <strong className="font-display">Snapshot, not a certificate.</strong> This Trust Passport is a time-limited
          snapshot for decision support. It is not a legal finding, verification guarantee, or verdict.
        </span>
      </p>

      <div className="print-surface">
        <Masthead
          title="Trust Passport"
          subtitle={String(data.summary || 'Decision-support snapshot')}
          aside={
            <>
              {data.risk_band && (
                <RiskBand band={data.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} />
              )}
              <Stamp lines={['Expires', expires.slice(0, 10)]} tone="ink" />
            </>
          }
        />
        <div className="grid gap-x-8 gap-y-2 text-sm md:grid-cols-2">
          <div className="entry pb-2"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Rules version · </span>{String(data.rules_version || '—')}</div>
          <div className="entry pb-2"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Analysis created · </span>{String(data.analysis_created_at || '—')}</div>
          <div className="entry pb-2"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Passport expires · </span>{expires}</div>
          <div className="entry pb-2"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Disclaimer · </span>{String(data.disclaimer_key || 'disclaimer.decision_support')}</div>
          {data.risk_score != null && (
            <div className="entry pb-2"><span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Risk indicator · </span>{String(data.risk_score)}/100</div>
          )}
        </div>
        <p className="mt-4 max-w-[68ch] text-sm leading-relaxed text-muted">{String(data.refresh_guidance || '')}</p>
      </div>

      <div className="print-surface">
        <Section title="Checks performed and not performed" meta={`${checks.length} listed`}>
          {checks.length === 0 ? (
            <p className="text-sm text-muted">No check information available.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Checks performed and not performed</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    {['Check', 'Status', 'Matched', 'Mismatched', 'Unknown', 'Checked at'].map((h) => (
                      <th key={h} className="py-2 pr-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {checks.map((c, i) => (
                    <tr key={i} className="border-b border-border/60">
                      <td className="py-2 pr-3 text-heading">{String(c.check_type || '')}</td>
                      <td className="py-2 pr-3 font-mono text-xs uppercase tracking-[0.08em]">{String(c.status || '')}</td>
                      <td className="py-2 pr-3">{Array.isArray(c.matched_fields) ? c.matched_fields.join(', ') || '—' : '—'}</td>
                      <td className="py-2 pr-3">{Array.isArray(c.mismatched_fields) ? c.mismatched_fields.join(', ') || '—' : '—'}</td>
                      <td className="py-2 pr-3">{Array.isArray(c.unknown_fields) ? c.unknown_fields.join(', ') || '—' : '—'}</td>
                      <td className="py-2 font-mono text-xs text-muted">{String(c.checked_at || '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>

      <div className="print-surface">
        <Section title="Risk factors" meta={`${factors.length} filed`}>
          {factors.length === 0 ? (
            <p className="text-sm text-muted">No risk factors recorded.</p>
          ) : (
            <ul>
              {factors.map((f, i) => (
                <li key={i} className="entry pb-3 text-sm">
                  <div className="font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-heading">{String(f.code || '')}</div>
                  <div className="mt-1 text-text">{String(f.explanation || '')}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="print-surface">
        <Section title="Recommendations" meta={`${recs.length} listed`}>
          {recs.length === 0 ? (
            <p className="text-sm text-muted">No recommendations recorded.</p>
          ) : (
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-text">
              {recs.map((r, i) => <li key={i}>{String(r.code || '')}{r.text_key ? ` — ${String(r.text_key)}` : ''}</li>)}
            </ul>
          )}
        </Section>
      </div>

      <div className="print-surface">
        <Section title="Community summary" meta="user-submitted">
          <p className="max-w-[68ch] text-sm leading-relaxed text-muted">
            {String((data.community as Record<string, unknown> | undefined)?.note || 'User-submitted; not verified facts.')}
          </p>
          <p className="mt-2 text-sm text-text">Approved report count: {String((data.community as Record<string, unknown> | undefined)?.approved_report_count ?? 0)}</p>
        </Section>
      </div>

      <p className="border-t border-border pt-3 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        No personal information is included in this passport.
      </p>
    </div>
  )
}

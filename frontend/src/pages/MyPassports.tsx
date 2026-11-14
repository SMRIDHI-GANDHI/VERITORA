import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listMyPassports, revokePassport, type PassportListItem } from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

function shortDate(v?: string | null) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

export function MyPassports() {
  const { t } = useTranslation()
  const [items, setItems] = useState<PassportListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await listMyPassports()
      setItems(res.items || [])
    } catch {
      setError(t('passports.loadError', { defaultValue: 'Unable to load your passports.' }))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onRevoke(id: string) {
    setMsg(null)
    setBusyId(id)
    try {
      await revokePassport(id)
      setMsg(t('passports.revoked', { defaultValue: 'Passport revoked.' }))
      await load()
    } catch {
      setMsg(t('passports.revokeError', { defaultValue: 'Unable to revoke passport.' }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">{t('passports.title', { defaultValue: 'My Passports' })}</h1>
        <p className="mt-2 text-muted">
          {t('passports.subtitle', {
            defaultValue:
              'Trust Passports are shareable, time-limited snapshots for decision support (not certificates). You can revoke an active passport at any time. Share links are shown only when created.',
          })}
        </p>
      </div>

      {msg && <div role="status" className="rounded-lg border border-border bg-surface p-3 text-sm">{msg}</div>}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold text-heading">{t('passports.listTitle', { defaultValue: 'Your passports' })}</h2>
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : error ? (
          <ErrorState message={error} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            {t('passports.empty', { defaultValue: 'No passports yet. Create one from an analysis result to share a snapshot.' })}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((p) => (
              <li key={p.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-heading">{t('passports.passport', { defaultValue: 'Passport' })}</span>
                      <span className={`rounded border px-2 py-0.5 text-xs font-medium ${p.status === 'active' ? 'border-success/40 text-success' : p.status === 'revoked' ? 'border-danger/40 text-danger' : 'border-border text-muted'}`}>
                        {p.status === 'active'
                          ? t('passports.status.active', { defaultValue: 'Active' })
                          : p.status === 'revoked'
                            ? t('passports.status.revoked', { defaultValue: 'Revoked' })
                            : t('passports.status.expired', { defaultValue: 'Expired' })}
                      </span>
                      {p.risk_band && <RiskBand band={p.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} />}
                    </div>
                    <div className="text-sm text-muted">
                      {t('passports.created', { defaultValue: 'Created' })}: {shortDate(p.created_at)} · {t('passports.expires', { defaultValue: 'Expires' })}: {shortDate(p.expires_at)}
                    </div>
                    {p.revoked_at && <div className="text-sm text-muted">{t('passports.revokedAt', { defaultValue: 'Revoked' })}: {shortDate(p.revoked_at)}</div>}
                    {p.summary && <p className="text-sm">{p.summary}</p>}
                    <div className="text-xs text-muted">
                      {t('passports.rules', { defaultValue: 'Rules' })}: {p.rules_version || '—'}
                      {p.risk_score != null ? ` · ${t('passports.indicator', { defaultValue: 'Indicator' })}: ${p.risk_score}/100` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch gap-2">
                    {p.analysis_id && (
                      <Link to={`/analysis/${p.analysis_id}`} className="rounded-lg border border-border bg-surface px-3 py-2 text-center text-sm font-medium">
                        {t('passports.viewAnalysis', { defaultValue: 'View analysis' })}
                      </Link>
                    )}
                    {p.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => void onRevoke(p.id)}
                        disabled={busyId === p.id}
                        className="rounded-lg border border-danger/40 px-3 py-2 text-sm font-medium text-danger disabled:opacity-50"
                      >
                        {busyId === p.id ? t('passports.revoking', { defaultValue: 'Revoking…' }) : t('passports.revoke', { defaultValue: 'Revoke' })}
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {t('passports.noLink', {
                    defaultValue:
                      'For security, the share token/link is shown only once at creation time and is not stored in retrievable form.',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

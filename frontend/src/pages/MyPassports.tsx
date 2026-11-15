import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { listMyPassports, revokePassport, type PassportListItem } from '../lib/api'
import { RiskBand } from '../components/ui/RiskBand'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp, type StampTone } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'

function shortDate(v?: string | null) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return v
  }
}

const STATUS_TONE: Record<string, StampTone> = {
  active: 'stamp',
  revoked: 'warning',
  expired: 'muted',
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
    <div className="mx-auto max-w-5xl space-y-8">
      <Masthead
        title={t('passports.title', { defaultValue: 'My Passports' })}
        subtitle={t('passports.subtitle', {
          defaultValue:
            'Trust Passports are shareable, time-limited snapshots for decision support (not certificates). You can revoke an active passport at any time. Share links are shown only when created.',
        })}
        aside={<Stamp lines={['Register', `${items.length} issued`]} tone="ink" />}
      />

      {msg && (
        <div role="status" className="border-l-2 border-cover bg-cover/[0.06] px-4 py-2.5 text-sm text-text">
          {msg}
        </div>
      )}

      <Section title={t('passports.listTitle', { defaultValue: 'Your passports' })} meta={`${items.length} issued`}>
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : error ? (
          <ErrorState message={error} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">
            {t('passports.empty', { defaultValue: 'No passports yet. Create one from an analysis result to share a snapshot.' })}
          </p>
        ) : (
          <ul>
            {items.map((p) => (
              <li key={p.id} className="entry pb-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-display text-[15px] font-bold text-heading">{t('passports.passport', { defaultValue: 'Passport' })}</span>
                      <Stamp
                        lines={[
                          p.status === 'active'
                            ? t('passports.status.active', { defaultValue: 'Active' })
                            : p.status === 'revoked'
                              ? t('passports.status.revoked', { defaultValue: 'Revoked' })
                              : t('passports.status.expired', { defaultValue: 'Expired' }),
                        ]}
                        tone={STATUS_TONE[p.status] || 'muted'}
                      />
                      {p.risk_band && (
                        <RiskBand band={p.risk_band as 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'} />
                      )}
                    </div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                      {t('passports.created', { defaultValue: 'Created' })}: {shortDate(p.created_at)} · {t('passports.expires', { defaultValue: 'Expires' })}: {shortDate(p.expires_at)}
                    </div>
                    {p.revoked_at && (
                      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                        {t('passports.revokedAt', { defaultValue: 'Revoked' })}: {shortDate(p.revoked_at)}
                      </div>
                    )}
                    {p.summary && <p className="max-w-[64ch] text-sm leading-relaxed text-text">{p.summary}</p>}
                    <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">
                      {t('passports.rules', { defaultValue: 'Rules' })}: {p.rules_version || '—'}
                      {p.risk_score != null ? ` · ${t('passports.indicator', { defaultValue: 'Indicator' })}: ${p.risk_score}/100` : ''}
                    </div>
                  </div>
                  <div className="flex flex-col items-stretch gap-2">
                    {p.analysis_id && (
                      <Link to={`/analysis/${p.analysis_id}`} className={buttonClass('secondary', 'sm')}>
                        {t('passports.viewAnalysis', { defaultValue: 'View analysis' })}
                      </Link>
                    )}
                    {p.status === 'active' && (
                      <Button
                        variant="danger"
                        size="sm"
                        type="button"
                        onClick={() => void onRevoke(p.id)}
                        disabled={busyId === p.id}
                      >
                        {busyId === p.id ? t('passports.revoking', { defaultValue: 'Revoking…' }) : t('passports.revoke', { defaultValue: 'Revoke' })}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-2.5 max-w-[70ch] text-xs leading-relaxed text-muted">
                  {t('passports.noLink', {
                    defaultValue:
                      'For security, the share token/link is shown only once at creation time and is not stored in retrievable form.',
                  })}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

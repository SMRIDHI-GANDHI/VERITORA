import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fallbackCyberResources, getCyberResources, type CyberResourcesResponse } from '../lib/api'
import { ExternalLink } from '../components/ui/ExternalLink'
import { Skeleton } from '../components/ui/Skeleton'

export function CyberHelp() {
  const { t } = useTranslation()
  const [data, setData] = useState<CyberResourcesResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getCyberResources()
      .then((res) => { if (!cancelled) setData(res) })
      .catch(() => { if (!cancelled) setData(fallbackCyberResources) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const resources = data?.resources ?? fallbackCyberResources.resources
  const primary = resources.filter((r) => r.primary)
  const certin = resources.filter((r) => r.id.startsWith('certin'))

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">{t('cyber.title')}</h1>
        <p className="mt-2 text-muted">{t('cyber.notOfficial')}</p>
      </header>

      {loading && <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}

      <div>
        <h2 className="mb-3 text-xl font-semibold">{t('cyber.primary')}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {primary.map((r) => (
            <div key={r.id} className="rounded-lg border border-border bg-surface p-4">
              <h3 className="font-semibold">{r.label}</h3>
              <div className="mt-2 text-sm">
                {r.type === 'phone' && r.href && <a href={r.href} className="text-accent underline">Call {r.tel}</a>}
                {r.url && <ExternalLink href={r.url}>{r.url}</ExternalLink>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-xl font-semibold">{t('cyber.certin')}</h2>
        <p className="mb-3 text-sm text-muted">{t('cyber.certinNote')}</p>
        <ul className="space-y-2 rounded-lg border border-border bg-surface p-4 text-sm">
          {certin.map((r) => (
            <li key={r.id}>
              <span className="font-medium">{r.label}: </span>
              {r.url && <ExternalLink href={r.url}>{r.url}</ExternalLink>}
              {r.email && <a href={`mailto:${r.email}`} className="text-accent underline">{r.email}</a>}
              {r.tel && !r.href && <span>{r.tel}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
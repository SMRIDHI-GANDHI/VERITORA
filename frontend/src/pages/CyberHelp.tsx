import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fallbackCyberResources, getCyberResources, type CyberResourcesResponse } from '../lib/api'
import { ExternalLink } from '../components/ui/ExternalLink'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'

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
    <div className="space-y-8">
      <Masthead
        title={t('cyber.title')}
        subtitle={t('cyber.notOfficial')}
        aside={<Stamp lines={['Official', 'links only']} tone="ink" />}
      />

      {loading && <div className="space-y-2"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>}

      <Section title={t('cyber.primary')} meta={`${primary.length} listed`}>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {primary.map((r) => (
            <div key={r.id} className="entry pb-4">
              <h3 className="font-display text-[15px] font-bold text-heading">{r.label}</h3>
              <div className="mt-1.5 text-sm">
                {r.type === 'phone' && r.href && <a href={r.href} className="text-accent underline underline-offset-4">Call {r.tel}</a>}
                {r.url && <ExternalLink href={r.url}>{r.url}</ExternalLink>}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('cyber.certin')} meta={`${certin.length} listed`}>
        <p className="mb-3 max-w-[68ch] text-sm leading-relaxed text-muted">{t('cyber.certinNote')}</p>
        <ul className="space-y-2.5 text-sm">
          {certin.map((r) => (
            <li key={r.id} className="entry pb-2.5">
              <span className="font-display font-bold text-heading">{r.label}: </span>
              {r.url && <ExternalLink href={r.url}>{r.url}</ExternalLink>}
              {r.email && <a href={`mailto:${r.email}`} className="text-accent underline underline-offset-4">{r.email}</a>}
              {r.tel && !r.href && <span className="font-mono text-[13px]">{r.tel}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

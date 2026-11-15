import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { buttonClass } from '../components/ui/buttonStyles'
import { Stamp } from '../components/ui/Stamp'

export function NotFound() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <section className="mx-auto max-w-2xl space-y-6" aria-labelledby="not-found-heading">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-accent">{t('notFound.eyebrow')}</p>
          <h1 id="not-found-heading" className="mt-2 font-display text-3xl font-bold leading-tight text-heading">
            {t('notFound.title')}
          </h1>
        </div>
        <Stamp lines={['No file', '404']} tone="muted" />
      </div>
      <div className="rule-double" aria-hidden="true" />
      <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted">{t('notFound.body')}</p>
      <div className="flex flex-wrap gap-2.5">
        <Link to="/" className={buttonClass('primary')}>
          {t('notFound.home')}
        </Link>
        <Link to={user ? '/dashboard' : '/signin'} className={buttonClass('secondary')}>
          {user ? t('notFound.dashboard') : t('notFound.signin')}
        </Link>
        <Link to="/help/cybercrime" className={buttonClass('secondary')}>
          {t('notFound.cyber')}
        </Link>
      </div>
    </section>
  )
}

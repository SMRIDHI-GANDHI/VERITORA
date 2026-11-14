import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'

export function NotFound() {
  const { t } = useTranslation()
  const { user } = useAuth()

  return (
    <section className="mx-auto max-w-2xl rounded-xl border border-border bg-surface p-8" aria-labelledby="not-found-heading">
      <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t('notFound.eyebrow')}</p>
      <h1 id="not-found-heading" className="mt-2 text-3xl font-bold text-heading">
        {t('notFound.title')}
      </h1>
      <p className="mt-3 text-muted">{t('notFound.body')}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/" className="rounded-lg bg-caramel px-4 py-2 font-semibold text-buttonText hover:opacity-95">
          {t('notFound.home')}
        </Link>
        <Link
          to={user ? '/dashboard' : '/signin'}
          className="rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-heading hover:bg-surface2"
        >
          {user ? t('notFound.dashboard') : t('notFound.signin')}
        </Link>
        <Link
          to="/help/cybercrime"
          className="rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-heading hover:bg-surface2"
        >
          {t('notFound.cyber')}
        </Link>
      </div>
    </section>
  )
}

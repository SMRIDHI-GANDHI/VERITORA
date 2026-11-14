import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'

const MAX_QUICK_CHECK = 5000
const URL_PATTERN = /^https?:\/\/\S+$/i

const CHECKS = [
  { to: '/analyze', titleKey: 'landing.paths.job', bodyKey: 'landing.paths.jobBody' },
  { to: '/verify/company', titleKey: 'landing.paths.company', bodyKey: 'landing.paths.companyBody' },
  { to: '/analyze?tab=message', titleKey: 'landing.paths.message', bodyKey: 'landing.paths.messageBody' },
  { to: '/verify/recruiter', titleKey: 'landing.paths.recruiter', bodyKey: 'landing.paths.recruiterBody' },
] as const

const OUTPUTS = [
  { titleKey: 'landing.outputs.riskTitle', bodyKey: 'landing.outputs.riskBody' },
  { titleKey: 'landing.outputs.evidenceTitle', bodyKey: 'landing.outputs.evidenceBody' },
  { titleKey: 'landing.outputs.unknownsTitle', bodyKey: 'landing.outputs.unknownsBody' },
] as const

const PRINCIPLES = [
  'landing.principles.allegations',
  'landing.principles.privacy',
  'landing.principles.rules',
] as const

export function Landing() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onQuickCheck(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value) {
      setError(t('landing.quickCheck.required'))
      return
    }
    setError(null)
    if (URL_PATTERN.test(value)) {
      navigate('/analyze?tab=url', { state: { prefillUrl: value } })
      return
    }
    navigate('/analyze?tab=job', { state: { prefillDescription: value.slice(0, 20000) } })
  }

  return (
    <div className="space-y-12">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start" aria-labelledby="landing-hero-heading">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t('landing.hero.eyebrow')}</p>
          <h1 id="landing-hero-heading" className="mt-3 text-4xl font-bold text-heading sm:text-5xl">
            {t('landing.hero.title')}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{t('landing.hero.body')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/analyze" className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText hover:opacity-95">
              {t('landing.hero.primaryCta')}
            </Link>
            <Link
              to="/verify/company"
              className="rounded-lg border border-border bg-surface px-5 py-2.5 font-semibold text-heading hover:bg-surface2"
            >
              {t('landing.hero.secondaryCta')}
            </Link>
            {user && (
              <Link
                to="/dashboard"
                className="rounded-lg border border-border bg-surface px-5 py-2.5 font-semibold text-heading hover:bg-surface2"
              >
                {t('landing.hero.dashboardCta')}
              </Link>
            )}
          </div>
        </div>

        <form onSubmit={onQuickCheck} className="rounded-xl border border-border bg-surface p-6 shadow-sm" noValidate>
          <h2 className="text-lg font-semibold text-heading">{t('landing.quickCheck.title')}</h2>
          <label htmlFor="quick-check" className="mt-4 block text-sm font-medium text-heading">
            {t('landing.quickCheck.label')}
          </label>
          <textarea
            id="quick-check"
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              if (error) setError(null)
            }}
            rows={5}
            maxLength={MAX_QUICK_CHECK}
            placeholder={t('landing.quickCheck.placeholder')}
            aria-invalid={!!error}
            aria-describedby={`quick-check-help${error ? ' quick-check-error' : ''}`}
            className="mt-2 w-full rounded-lg border border-border bg-surface p-3 text-text"
          />
          <p id="quick-check-help" className="mt-2 text-xs text-muted">
            {t('landing.quickCheck.help')}
          </p>
          {error && (
            <p id="quick-check-error" role="alert" className="mt-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-caramel px-4 py-2.5 font-semibold text-buttonText hover:opacity-95"
          >
            {t('landing.quickCheck.submit')}
          </button>
          <p className="mt-3 text-xs text-muted">{t('landing.quickCheck.caveat')}</p>
        </form>
      </section>

      <section aria-labelledby="landing-outputs-heading">
        <h2 id="landing-outputs-heading" className="text-2xl font-semibold text-heading">
          {t('landing.outputs.title')}
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {OUTPUTS.map((item) => (
            <article key={item.titleKey} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="font-semibold text-heading">{t(item.titleKey)}</h3>
              <p className="mt-2 text-sm text-muted">{t(item.bodyKey)}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-paths-heading">
        <h2 id="landing-paths-heading" className="text-2xl font-semibold text-heading">
          {t('landing.paths.title')}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {CHECKS.map((check) => (
            <Link
              key={check.to}
              to={check.to}
              className="rounded-xl border border-border bg-surface p-5 transition hover:border-caramel hover:bg-surface2"
            >
              <h3 className="font-semibold text-heading">{t(check.titleKey)}</h3>
              <p className="mt-2 text-sm text-muted">{t(check.bodyKey)}</p>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="landing-safety-heading"
        className="rounded-xl border border-warning/40 bg-warning/10 p-6"
      >
        <h2 id="landing-safety-heading" className="text-xl font-semibold text-heading">
          {t('landing.safety.title')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-text">{t('landing.safety.body')}</p>
        <Link
          to="/help/cybercrime"
          className="mt-4 inline-block rounded-lg border border-border bg-surface px-4 py-2 font-semibold text-heading hover:bg-surface2"
        >
          {t('landing.safety.cta')}
        </Link>
      </section>

      <section aria-labelledby="landing-principles-heading">
        <h2 id="landing-principles-heading" className="text-2xl font-semibold text-heading">
          {t('landing.principles.title')}
        </h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {PRINCIPLES.map((key) => (
            <li key={key} className="rounded-lg border border-border bg-surface2/40 p-4 text-sm text-text">
              {t(key)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { Icon } from '../components/ui/Icon'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass, fieldHintClass, fieldErrorClass } from '../components/ui/Field'

const MAX_QUICK_CHECK = 5000
const URL_PATTERN = /^https?:\/\/\S+$/i

const CHECKS = [
  { to: '/analyze', titleKey: 'landing.paths.job', bodyKey: 'landing.paths.jobBody' },
  { to: '/verify/company', titleKey: 'landing.paths.company', bodyKey: 'landing.paths.companyBody' },
  { to: '/analyze?tab=message', titleKey: 'landing.paths.message', bodyKey: 'landing.paths.messageBody' },
  { to: '/verify/recruiter', titleKey: 'landing.paths.recruiter', bodyKey: 'landing.paths.recruiterBody' },
] as const

const OUTPUTS = [
  { titleKey: 'landing.outputs.riskTitle', bodyKey: 'landing.outputs.riskBody', icon: 'stamp' as const },
  { titleKey: 'landing.outputs.evidenceTitle', bodyKey: 'landing.outputs.evidenceBody', icon: 'file' as const },
  { titleKey: 'landing.outputs.unknownsTitle', bodyKey: 'landing.outputs.unknownsBody', icon: 'search' as const },
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
    <div>
      <section className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-start" aria-labelledby="landing-hero-heading">
        <div>
          <h1
            id="landing-hero-heading"
            className="font-display text-[clamp(2.2rem,4.6vw,3.5rem)] leading-[1.08] tracking-[-0.02em] text-heading"
          >
            {t('landing.hero.title')}
          </h1>
          <div className="rule-double mt-5" aria-hidden="true" />
          <p className="mt-5 max-w-[58ch] text-[17px] leading-[1.65] text-text">{t('landing.hero.body')}</p>
          <p className="mt-4 max-w-[58ch] font-mono text-[13px] font-bold uppercase leading-relaxed tracking-[0.14em] text-stamp">
            {t('landing.hero.eyebrow')}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/analyze" className={buttonClass('primary', 'lg')}>
              {t('landing.hero.primaryCta')}
            </Link>
            <Link to="/verify/company" className={buttonClass('secondary', 'lg')}>
              {t('landing.hero.secondaryCta')}
            </Link>
            {user && (
              <Link to="/dashboard" className={buttonClass('secondary', 'lg')}>
                {t('landing.hero.dashboardCta')}
              </Link>
            )}
          </div>
        </div>

        <form onSubmit={onQuickCheck} className="border-2 border-heading bg-surface shadow-paper" noValidate>
          <div className="border-b-2 border-heading px-6 py-4">
            <h2 className="font-display text-xl font-bold text-heading">{t('landing.quickCheck.title')}</h2>
          </div>
          <div className="px-6 py-5">
            <label htmlFor="quick-check" className={fieldLabelClass}>
              {t('landing.quickCheck.label')}
            </label>
            <textarea
              id="quick-check"
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                if (error) setError(null)
              }}
              rows={6}
              maxLength={MAX_QUICK_CHECK}
              placeholder={t('landing.quickCheck.placeholder')}
              aria-invalid={!!error}
              aria-describedby={`quick-check-help${error ? ' quick-check-error' : ''}`}
              className={fieldClass}
            />
            <p id="quick-check-help" className={fieldHintClass}>
              {t('landing.quickCheck.help')}
            </p>
            {error && (
              <p id="quick-check-error" role="alert" className={fieldErrorClass}>
                <Icon name="warning" size={15} className="mt-0.5" />
                <span>{error}</span>
              </p>
            )}
            <button type="submit" className={buttonClass('primary', 'lg', 'mt-5 w-full')}>
              {t('landing.quickCheck.submit')}
            </button>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{t('landing.quickCheck.caveat')}</p>
          </div>
        </form>
      </section>

      <section aria-labelledby="landing-outputs-heading" className="mt-14">
        <h2 id="landing-outputs-heading" className="font-display text-2xl font-bold text-heading">
          {t('landing.outputs.title')}
        </h2>
        <div className="rule-double-quiet mt-3" aria-hidden="true" />
        <dl className="mt-1">
          {OUTPUTS.map((item) => (
            <div key={item.titleKey} className="entry flex gap-4 py-5">
              <Icon name={item.icon} size={20} className="mt-1 text-stamp" />
              <div className="min-w-0">
                <dt className="font-display text-[17px] font-bold text-heading">{t(item.titleKey)}</dt>
                <dd className="mt-1.5 max-w-[70ch] text-[15px] leading-relaxed text-muted">{t(item.bodyKey)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="landing-paths-heading" className="mt-14">
        <h2 id="landing-paths-heading" className="font-display text-2xl font-bold text-heading">
          {t('landing.paths.title')}
        </h2>
        <div className="rule-double-quiet mt-3" aria-hidden="true" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {CHECKS.map((check) => (
            <Link
              key={check.to}
              to={check.to}
              className="group flex items-start justify-between gap-5 border border-border bg-surface px-5 py-5 transition hover:border-heading hover:bg-surface2"
            >
              <span className="min-w-0">
                <span className="block font-display text-[17px] font-bold text-heading">{t(check.titleKey)}</span>
                <span className="mt-1.5 block text-[14.5px] leading-relaxed text-muted">{t(check.bodyKey)}</span>
              </span>
              <Icon name="arrow" size={18} className="mt-1.5 text-accent transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="landing-safety-heading" className="mt-14 border-2 border-warning bg-warning/10 px-6 py-6 sm:px-8">
        <div className="flex items-start gap-4">
          <Icon name="warning" size={24} className="mt-1 text-warning" />
          <div>
            <h2 id="landing-safety-heading" className="font-display text-xl font-bold text-heading">
              {t('landing.safety.title')}
            </h2>
            <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-text">{t('landing.safety.body')}</p>
            <Link to="/help/cybercrime" className={buttonClass('secondary', 'md', 'mt-5')}>
              {t('landing.safety.cta')}
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="landing-principles-heading" className="mt-14">
        <h2 id="landing-principles-heading" className="font-display text-2xl font-bold text-heading">
          {t('landing.principles.title')}
        </h2>
        <div className="rule-double-quiet mt-3" aria-hidden="true" />
        <ul className="mt-1">
          {PRINCIPLES.map((key) => (
            <li key={key} className="entry flex items-start gap-3.5 py-4 text-[15px] leading-relaxed text-text">
              <Icon name="checked" size={17} className="mt-1 text-success" />
              <span className="max-w-[76ch]">{t(key)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

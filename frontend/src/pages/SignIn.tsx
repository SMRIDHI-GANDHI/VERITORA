import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { signInErrorMessage } from '../lib/authErrors'
import { AuthFrame } from '../components/AuthFrame'
import { Icon } from '../components/ui/Icon'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'

export function SignIn() {
  const { t } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation() as { state?: { from?: { pathname?: string } } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email || !password) {
      setError('Please enter your email and password.')
      return
    }
    setSubmitting(true)
    try {
      await login(email, password)
      const to = location.state?.from?.pathname || '/dashboard'
      navigate(to, { replace: true })
    } catch (err) {
      setError(signInErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-[1060px]">
      <AuthFrame>
        <h1 className="font-display text-[26px] leading-tight text-heading">{t('nav.signin')}</h1>
        <div className="rule-double mt-3" aria-hidden="true" />
        <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 border-2 border-danger bg-danger/10 px-4 py-3 text-sm font-semibold leading-snug text-danger"
            >
              <Icon name="warning" size={16} className="mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label htmlFor="email" className={fieldLabelClass}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label htmlFor="password" className={fieldLabelClass}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={buttonClass('primary', 'lg', 'w-full')}
          >
            {submitting ? 'Signing in...' : t('nav.signin')}
          </button>
        </form>
        <p className="mt-6 border-t border-dotted border-border pt-4 text-sm text-muted">
          No account?{' '}
          <Link to="/signup" className="font-semibold text-accent underline underline-offset-4">
            {t('nav.signup')}
          </Link>
        </p>
      </AuthFrame>
    </section>
  )
}

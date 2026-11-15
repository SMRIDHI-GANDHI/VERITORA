import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'
import { signUpErrorMessage } from '../lib/authErrors'
import { AuthFrame } from '../components/AuthFrame'
import { Icon } from '../components/ui/Icon'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass, fieldHintClass } from '../components/ui/Field'

export function SignUp() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name || !email || !password) {
      setError('Please fill in all required fields.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await register(name, email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(signUpErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto max-w-[1060px]">
      <AuthFrame>
        <h1 className="font-display text-[26px] leading-tight text-heading">{t('nav.signup')}</h1>
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
            <label htmlFor="name" className={fieldLabelClass}>
              Name
            </label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} required />
          </div>
          <div>
            <label htmlFor="su-email" className={fieldLabelClass}>
              Email
            </label>
            <input
              id="su-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <div>
            <label htmlFor="su-password" className={fieldLabelClass}>
              Password
            </label>
            <input
              id="su-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldClass}
              required
            />
            <p className={fieldHintClass}>{t('auth.passwordHint')}</p>
          </div>
          <div>
            <label htmlFor="su-confirm" className={fieldLabelClass}>
              Confirm password
            </label>
            <input
              id="su-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
              required
            />
          </div>
          <button type="submit" disabled={submitting} className={buttonClass('primary', 'lg', 'w-full')}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 border-t border-dotted border-border pt-4 text-sm text-muted">
          Already have an account?{' '}
          <Link to="/signin" className="font-semibold text-accent underline underline-offset-4">
            {t('nav.signin')}
          </Link>
        </p>
      </AuthFrame>
    </section>
  )
}

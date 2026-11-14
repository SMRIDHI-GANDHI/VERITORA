import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { signInErrorMessage } from '../lib/authErrors'

export function SignIn() {
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
    <section className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Sign In</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6" noValidate>
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</div>}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2" required />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">Password</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-bg px-3 py-2" required />
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded bg-caramel px-4 py-2 font-semibold text-buttonText disabled:opacity-60">
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">No account? <Link to="/signup" className="text-accent underline">Sign up</Link></p>
    </section>
  )
}
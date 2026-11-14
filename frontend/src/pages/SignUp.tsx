import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { signUpErrorMessage } from '../lib/authErrors'

export function SignUp() {
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
    if (!name || !email || !password) { setError('Please fill in all required fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
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
    <section className="mx-auto max-w-md">
      <h1 className="mb-4 text-2xl font-bold">Sign Up</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-6" noValidate>
        {error && <div role="alert" className="rounded border border-danger/30 bg-danger/10 p-2 text-sm text-danger">{error}</div>}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2" required />
        </div>
        <div>
          <label htmlFor="su-email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2" required />
        </div>
        <div>
          <label htmlFor="su-password" className="mb-1 block text-sm font-medium">Password</label>
          <input id="su-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2" required />
        </div>
        <div>
          <label htmlFor="su-confirm" className="mb-1 block text-sm font-medium">Confirm password</label>
          <input id="su-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2" required />
        </div>
        <button type="submit" disabled={submitting} className="w-full rounded bg-caramel px-4 py-2 font-semibold text-buttonText disabled:opacity-60">
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">Already have an account? <Link to="/signin" className="text-accent underline">Sign in</Link></p>
    </section>
  )
}
import { useState, type FormEvent } from 'react'
import { StatusLabel, type StatusKind } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { HttpError, verifyRecruiter, type VerifyRecruiterResponse, type VerificationCheck } from '../lib/api'

function statusKind(s: string): StatusKind {
  if (s === 'consistent' || s === 'information_found' || s === 'checked') return 'checked'
  if (s === 'mismatch' || s === 'warning') return 'warning'
  if (s === 'not_checked') return 'not_checked'
  return 'inconclusive'
}

export function VerifyRecruiter() {
  const [form, setForm] = useState({
    recruiter_name: '',
    claimed_company: '',
    claimed_role: '',
    email: '',
    profile_url: '',
    company_website: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyRecruiterResponse | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!form.recruiter_name.trim() || !form.claimed_company.trim()) {
      setError('Recruiter name and claimed company are required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await verifyRecruiter({
        recruiter_name: form.recruiter_name.trim(),
        claimed_company: form.claimed_company.trim(),
        claimed_role: form.claimed_role.trim() || undefined,
        email: form.email.trim() || undefined,
        profile_url: form.profile_url.trim() || undefined,
        company_website: form.company_website.trim() || undefined,
      })
      setResult(res)
    } catch (err) {
      if (err instanceof HttpError) setError(err.problem?.detail || err.message)
      else setError('Verification failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-surface p-2.5 text-text'
  const labelCls = 'mb-1 block text-sm font-medium text-heading'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Recruiter Verification</h1>
        <p className="mt-2 text-muted">
          Compare provided recruiter details against independently identified company information. Generic email providers are shown as informational unknowns, not warnings.
        </p>
        <p className="mt-2 rounded-lg border border-border bg-surface2/40 p-3 text-sm">
          Contact the company via independently sourced official channels before sharing information or taking action.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label htmlFor="rname" className={labelCls}>Recruiter name <span aria-hidden="true">*</span></label><input id="rname" value={form.recruiter_name} onChange={(e) => setForm({ ...form, recruiter_name: e.target.value })} className={inputCls} required /></div>
          <div><label htmlFor="ccomp" className={labelCls}>Claimed company <span aria-hidden="true">*</span></label><input id="ccomp" value={form.claimed_company} onChange={(e) => setForm({ ...form, claimed_company: e.target.value })} className={inputCls} required /></div>
          <div><label htmlFor="crole" className={labelCls}>Claimed role (optional)</label><input id="crole" value={form.claimed_role} onChange={(e) => setForm({ ...form, claimed_role: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="remail" className={labelCls}>Recruiter email (optional)</label><input id="remail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></div>
          <div><label htmlFor="rprof" className={labelCls}>Public profile URL (optional)</label><input id="rprof" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} className={inputCls} placeholder="https://..." /></div>
          <div><label htmlFor="cweb" className={labelCls}>Company website (optional)</label><input id="cweb" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} className={inputCls} placeholder="https://..." /></div>
        </div>
        {error && <ErrorState message={error} />}
        <button type="submit" disabled={submitting} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
          {submitting ? 'Verifying…' : 'Verify recruiter'}
        </button>
      </form>

      {result && (
        <div className="space-y-6" aria-live="polite">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-2 text-lg font-semibold text-heading">Overall status</h2>
            <StatusLabel status={statusKind(result.overall_status)} />
            <p className="mt-2 text-sm text-muted">Checked at: {result.checked_at || '—'}</p>
            <p className="mt-2 text-sm">{result.safe_next_step}</p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-3 text-lg font-semibold text-heading">Checks and affiliation evidence</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead><tr className="border-b border-border text-left text-muted"><th className="py-2 pr-3">Check</th><th className="py-2 pr-3">Status</th><th className="py-2 pr-3">Matched</th><th className="py-2 pr-3">Mismatched</th><th className="py-2 pr-3">Unknown</th><th className="py-2 pr-3">Source</th></tr></thead>
                <tbody>
                  {result.checks.map((c: VerificationCheck, i) => (
                    <tr key={i} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium">{c.check_type}</td>
                      <td className="py-2 pr-3"><StatusLabel status={statusKind(c.status)} /></td>
                      <td className="py-2 pr-3">{c.matched_fields?.length ? c.matched_fields.join(', ') : '—'}</td>
                      <td className="py-2 pr-3">{c.mismatched_fields?.length ? c.mismatched_fields.join(', ') : '—'}</td>
                      <td className="py-2 pr-3">{c.unknown_fields?.length ? c.unknown_fields.join(', ') : '—'}</td>
                      <td className="py-2 pr-3">{c.source_url ? <a className="text-accent underline" href={c.source_url} target="_blank" rel="noopener noreferrer">Source</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {(result.unknowns?.length || result.mismatches?.length) ? (
            <section className="rounded-xl border border-border bg-surface p-6">
              <h2 className="mb-2 text-lg font-semibold text-heading">Mismatches and unknowns</h2>
              {result.mismatches?.length ? <div className="mb-2"><h3 className="font-medium">Mismatches</h3><ul className="list-disc pl-5 text-sm">{result.mismatches.map((m, i) => <li key={i}>{m}</li>)}</ul></div> : null}
              {result.unknowns?.length ? <div><h3 className="font-medium">Unknowns / notes</h3><ul className="list-disc pl-5 text-sm">{result.unknowns.map((m, i) => <li key={i}>{m}</li>)}</ul></div> : null}
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
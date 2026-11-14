import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusLabel, type StatusKind } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { HttpError, verifyCompany, type VerificationCheck, type VerifyCompanyResponse } from '../lib/api'

function statusKind(s: VerificationCheck['status']): StatusKind {
  if (s === 'consistent' || s === 'information_found') return 'checked'
  if (s === 'mismatch') return 'warning'
  if (s === 'inconclusive') return 'inconclusive'
  return 'not_checked'
}

export function VerifyCompany() {
  const navigate = useNavigate()
  const [companyName, setCompanyName] = useState('')
  const [website, setWebsite] = useState('')
  const [emailDomain, setEmailDomain] = useState('')
  const [registrationId, setRegistrationId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<VerifyCompanyResponse | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)
    if (!companyName.trim()) {
      setError('Company name is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await verifyCompany({
        company_name: companyName.trim(),
        website: website.trim() || undefined,
        email_domain: emailDomain.trim() || undefined,
        registration_id: registrationId.trim() || undefined,
      })
      setResult(res)
    } catch (err) {
      if (err instanceof HttpError) {
        setError(err.problem?.detail || err.message || 'Verification failed. Please try again.')
      } else {
        setError('Verification failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function addToAnalysis() {
    // handoff to analyzer with prefilled company context
    navigate('/analyze', { state: { company_name: companyName, company_website: website } })
  }

  const inputCls = 'w-full rounded-lg border border-border bg-surface p-2.5 text-text'
  const labelCls = 'mb-1 block text-sm font-medium text-heading'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Company Verification</h1>
        <p className="mt-2 text-muted">
          Check available signals about a company. Results show matched, mismatched, and unknown information based on available sources.
        </p>
        <p className="mt-2 rounded-lg border border-border bg-surface2/40 p-3 text-sm">
          Note: A company&apos;s existence does not prove that a specific job posting or recruiter is authorized.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6" noValidate>
        <div>
          <label htmlFor="cv-name" className={labelCls}>Company name <span aria-hidden="true">*</span></label>
          <input id="cv-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputCls} required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div><label htmlFor="cv-web" className={labelCls}>Website (optional)</label><input id="cv-web" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://..." /></div>
          <div><label htmlFor="cv-email" className={labelCls}>Email domain (optional)</label><input id="cv-email" value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} className={inputCls} placeholder="example.com" /></div>
          <div className="md:col-span-2"><label htmlFor="cv-reg" className={labelCls}>Registration ID (optional)</label><input id="cv-reg" value={registrationId} onChange={(e) => setRegistrationId(e.target.value)} className={inputCls} /></div>
        </div>
        {error && <ErrorState message={error} />}
        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
            {submitting ? 'Verifying…' : 'Verify company'}
          </button>
          {result && (
            <button type="button" onClick={addToAnalysis} className="rounded-lg border border-border bg-surface px-4 py-2.5 font-medium text-heading">
              Add this to my analysis
            </button>
          )}
        </div>
      </form>

      {result && (
        <div className="space-y-6" aria-live="polite">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-2 text-lg font-semibold text-heading">Overall status</h2>
            <StatusLabel status={statusKind(result.overall_status)} />
            <p className="mt-2 text-sm text-muted">Checked at: {result.checked_at || '—'}</p>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-3 text-lg font-semibold text-heading">Verification checks</h2>
            {result.checks.length === 0 ? (
              <p className="text-sm text-muted">No checks available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      <th className="py-2 pr-3">Check</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Matched</th>
                      <th className="py-2 pr-3">Mismatched</th>
                      <th className="py-2 pr-3">Unknown / not checked</th>
                      <th className="py-2 pr-3">Source</th>
                      <th className="py-2">Checked at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.checks.map((c, i) => {
                      const reason = c.details && typeof c.details === 'object' ? (c.details as Record<string, unknown>).reason : undefined
                      return (
                        <tr key={i} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3 font-medium">{c.check_type}</td>
                          <td className="py-2 pr-3"><StatusLabel status={statusKind(c.status)} />{reason ? <div className="mt-1 text-xs text-muted">Reason: {String(reason)}</div> : null}</td>
                          <td className="py-2 pr-3">{c.matched_fields?.length ? c.matched_fields.join(', ') : '—'}</td>
                          <td className="py-2 pr-3">{c.mismatched_fields?.length ? c.mismatched_fields.join(', ') : '—'}</td>
                          <td className="py-2 pr-3">{c.unknown_fields?.length ? c.unknown_fields.join(', ') : '—'}</td>
                          <td className="py-2 pr-3">{c.source_url ? <a className="text-accent underline" href={c.source_url} target="_blank" rel="noopener noreferrer">Source</a> : '—'}</td>
                          <td className="py-2">{c.checked_at || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="mb-3 text-lg font-semibold text-heading">Community reports (approved)</h2>
            <p className="text-sm text-muted">
              {result.community?.note || 'User-submitted reports are shown only after moderation and are not treated as confirmed facts.'}
            </p>
            <p className="mt-2 text-sm">Approved report count: {result.community?.approved_report_count ?? 0}</p>
            <p className="mt-2 text-xs text-muted">Labels are neutral and reflect moderation status, not confirmation of wrongdoing.</p>
          </section>

          <div className="text-sm">
            <Link to="/analyze" className="text-accent underline">Go to job analyzer</Link>
          </div>
        </div>
      )}
    </div>
  )
}

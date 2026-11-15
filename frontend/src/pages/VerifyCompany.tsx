import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StatusLabel, type StatusKind } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Masthead
        title="Company Verification"
        subtitle="Check available signals about a company. Results show matched, mismatched, and unknown information based on available sources."
        aside={<Stamp lines={['Check', 'company']} tone="ink" />}
      />

      <p className="max-w-[68ch] border-l-2 border-cover bg-cover/[0.05] px-4 py-3 text-sm leading-relaxed text-text">
        Note: A company&apos;s existence does not prove that a specific job posting or recruiter is authorized.
      </p>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Section title="Company details" meta="required fields marked">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="cv-name" className={fieldLabelClass}>Company name <span aria-hidden="true">*</span></label>
              <input id="cv-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={fieldClass} required />
            </div>
            <div><label htmlFor="cv-web" className={fieldLabelClass}>Website (optional)</label><input id="cv-web" value={website} onChange={(e) => setWebsite(e.target.value)} className={fieldClass} placeholder="https://..." /></div>
            <div><label htmlFor="cv-email" className={fieldLabelClass}>Email domain (optional)</label><input id="cv-email" value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} className={fieldClass} placeholder="example.com" /></div>
            <div className="md:col-span-2"><label htmlFor="cv-reg" className={fieldLabelClass}>Registration ID (optional)</label><input id="cv-reg" value={registrationId} onChange={(e) => setRegistrationId(e.target.value)} className={fieldClass} /></div>
          </div>
        </Section>
        {error && <ErrorState message={error} />}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? 'Verifying…' : 'Verify company'}
          </Button>
          {result && (
            <Button variant="secondary" type="button" onClick={addToAnalysis} size="lg">
              Add this to my analysis
            </Button>
          )}
        </div>
      </form>

      {result && (
        <div className="space-y-8" aria-live="polite">
          <Section title="Overall status" meta={result.checked_at ? `checked ${result.checked_at}` : 'not checked'}>
            <div className="flex flex-wrap items-center gap-4">
              <StatusLabel status={statusKind(result.overall_status)} />
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Checked at: {result.checked_at || '—'}</p>
            </div>
          </Section>

          <Section title="Verification checks" meta={`${result.checks.length} run`}>
            {result.checks.length === 0 ? (
              <p className="text-sm text-muted">No checks available.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Verification checks for this company</caption>
                  <thead>
                    <tr className="border-b border-border text-left text-muted">
                      {['Check', 'Status', 'Matched', 'Mismatched', 'Unknown / not checked', 'Source', 'Checked at'].map((h) => (
                        <th key={h} className="py-2 pr-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.checks.map((c, i) => {
                      const reason = c.details && typeof c.details === 'object' ? (c.details as Record<string, unknown>).reason : undefined
                      return (
                        <tr key={i} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3 font-medium text-heading">{c.check_type}</td>
                          <td className="py-2 pr-3"><StatusLabel status={statusKind(c.status)} />{reason ? <div className="mt-1 text-xs text-muted">Reason: {String(reason)}</div> : null}</td>
                          <td className="py-2 pr-3">{c.matched_fields?.length ? c.matched_fields.join(', ') : '—'}</td>
                          <td className="py-2 pr-3">{c.mismatched_fields?.length ? c.mismatched_fields.join(', ') : '—'}</td>
                          <td className="py-2 pr-3">{c.unknown_fields?.length ? c.unknown_fields.join(', ') : '—'}</td>
                          <td className="py-2 pr-3">{c.source_url ? <a className="text-accent underline underline-offset-4" href={c.source_url} target="_blank" rel="noopener noreferrer">Source</a> : '—'}</td>
                          <td className="py-2 font-mono text-xs text-muted">{c.checked_at || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Community reports (approved)" meta={`${result.community?.approved_report_count ?? 0} approved`}>
            <p className="max-w-[68ch] text-sm leading-relaxed text-muted">
              {result.community?.note || 'User-submitted reports are shown only after moderation and are not treated as confirmed facts.'}
            </p>
            <p className="mt-3 text-sm text-text">Approved report count: {result.community?.approved_report_count ?? 0}</p>
            <p className="mt-2 text-xs text-muted">Labels are neutral and reflect moderation status, not confirmation of wrongdoing.</p>
          </Section>

          <div className="text-sm">
            <Link to="/analyze" className={buttonClass('ghost')}>Go to job analyzer</Link>
          </div>
        </div>
      )}
    </div>
  )
}

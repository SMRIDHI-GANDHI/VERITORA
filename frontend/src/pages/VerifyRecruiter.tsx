import { useState, type FormEvent } from 'react'
import { StatusLabel, type StatusKind } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Masthead
        title="Recruiter Verification"
        subtitle="Compare provided recruiter details against independently identified company information. Generic email providers are shown as informational unknowns, not warnings."
        aside={<Stamp lines={['Check', 'recruiter']} tone="ink" />}
      />

      <p className="max-w-[68ch] border-l-2 border-cover bg-cover/[0.05] px-4 py-3 text-sm leading-relaxed text-text">
        Contact the company via independently sourced official channels before sharing information or taking action.
      </p>

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Section title="Recruiter details" meta="required fields marked">
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="rname" className={fieldLabelClass}>Recruiter name <span aria-hidden="true">*</span></label><input id="rname" value={form.recruiter_name} onChange={(e) => setForm({ ...form, recruiter_name: e.target.value })} className={fieldClass} required /></div>
            <div><label htmlFor="ccomp" className={fieldLabelClass}>Claimed company <span aria-hidden="true">*</span></label><input id="ccomp" value={form.claimed_company} onChange={(e) => setForm({ ...form, claimed_company: e.target.value })} className={fieldClass} required /></div>
            <div><label htmlFor="crole" className={fieldLabelClass}>Claimed role (optional)</label><input id="crole" value={form.claimed_role} onChange={(e) => setForm({ ...form, claimed_role: e.target.value })} className={fieldClass} /></div>
            <div><label htmlFor="remail" className={fieldLabelClass}>Recruiter email (optional)</label><input id="remail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={fieldClass} /></div>
            <div><label htmlFor="rprof" className={fieldLabelClass}>Public profile URL (optional)</label><input id="rprof" value={form.profile_url} onChange={(e) => setForm({ ...form, profile_url: e.target.value })} className={fieldClass} placeholder="https://..." /></div>
            <div><label htmlFor="cweb" className={fieldLabelClass}>Company website (optional)</label><input id="cweb" value={form.company_website} onChange={(e) => setForm({ ...form, company_website: e.target.value })} className={fieldClass} placeholder="https://..." /></div>
          </div>
        </Section>
        {error && <ErrorState message={error} />}
        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? 'Verifying…' : 'Verify recruiter'}
        </Button>
      </form>

      {result && (
        <div className="space-y-8" aria-live="polite">
          <Section title="Overall status" meta={result.checked_at ? `checked ${result.checked_at}` : 'not checked'}>
            <div className="flex flex-wrap items-center gap-4">
              <StatusLabel status={statusKind(result.overall_status)} />
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Checked at: {result.checked_at || '—'}</p>
            </div>
            <p className="mt-3 max-w-[68ch] text-sm leading-relaxed text-text">{result.safe_next_step}</p>
          </Section>

          <Section title="Checks and affiliation evidence" meta={`${result.checks.length} run`}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">Recruiter verification checks</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    {['Check', 'Status', 'Matched', 'Mismatched', 'Unknown', 'Source'].map((h) => (
                      <th key={h} className="py-2 pr-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.checks.map((c: VerificationCheck, i) => (
                    <tr key={i} className="border-b border-border/60 align-top">
                      <td className="py-2 pr-3 font-medium text-heading">{c.check_type}</td>
                      <td className="py-2 pr-3"><StatusLabel status={statusKind(c.status)} /></td>
                      <td className="py-2 pr-3">{c.matched_fields?.length ? c.matched_fields.join(', ') : '—'}</td>
                      <td className="py-2 pr-3">{c.mismatched_fields?.length ? c.mismatched_fields.join(', ') : '—'}</td>
                      <td className="py-2 pr-3">{c.unknown_fields?.length ? c.unknown_fields.join(', ') : '—'}</td>
                      <td className="py-2 pr-3">{c.source_url ? <a className="text-accent underline underline-offset-4" href={c.source_url} target="_blank" rel="noopener noreferrer">Source</a> : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {(result.unknowns?.length || result.mismatches?.length) ? (
            <Section title="Mismatches and unknowns" meta="not evidence">
              <div className="grid gap-6 md:grid-cols-2">
                {result.mismatches?.length ? (
                  <div>
                    <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Mismatches</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text">{result.mismatches.map((m, i) => <li key={i}>{m}</li>)}</ul>
                  </div>
                ) : null}
                {result.unknowns?.length ? (
                  <div>
                    <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Unknowns / notes</h3>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-text">{result.unknowns.map((m, i) => <li key={i}>{m}</li>)}</ul>
                  </div>
                ) : null}
              </div>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  )
}

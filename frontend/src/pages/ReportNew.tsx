import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createReport, type ReportCategory, type ReportCreatePayload } from '../lib/api'
import { detectPii, maskPii } from '../lib/pii'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'

const categories: { value: ReportCategory; label: string }[] = [
  { value: 'payment_request', label: 'Payment request' },
  { value: 'impersonation_concern', label: 'Impersonation concern' },
  { value: 'suspicious_link', label: 'Suspicious link' },
  { value: 'fake_offer_concern', label: 'Potentially fraudulent offer concern' },
  { value: 'data_request', label: 'Sensitive data request' },
  { value: 'misleading_job_details', label: 'Misleading job details' },
  { value: 'other', label: 'Other' },
]

export function ReportNew() {
  const [form, setForm] = useState<ReportCreatePayload>({
    company_name: '',
    category: 'other',
    description: '',
    interacted: false,
    paid: false,
    shared_info: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ id: string; moderation_status: string; pii_warnings: string[] } | null>(null)
  const [ack, setAck] = useState(false)

  const piiWarnings = useMemo(() => detectPii(form.description), [form.description])

  function set<K extends keyof ReportCreatePayload>(k: K, v: ReportCreatePayload[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!ack) {
      setError('Please review the redaction and submission notice before submitting.')
      return
    }
    if (!form.company_name.trim() || form.description.trim().length < 30) {
      setError('Company name is required and description must be at least 30 characters.')
      return
    }
    setSubmitting(true)
    try {
      const payload: ReportCreatePayload = {
        ...form,
        company_name: form.company_name.trim(),
        description: form.description,
        job_title: form.job_title?.trim() || undefined,
        job_url: form.job_url?.trim() || undefined,
        recruiter_identifier: form.recruiter_identifier?.trim() || undefined,
        occurred_on: form.occurred_on || undefined,
      }
      const res = await createReport(payload)
      setResult(res)
    } catch {
      setError('Unable to submit report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl space-y-7">
        <Masthead
          title="Report submitted (pending review)"
          aside={<Stamp lines={['Filed', 'under review']} tone="warning" />}
        />
        <p className="max-w-[62ch] text-[15px] leading-relaxed text-text">
          Thank you. Your submission is <strong>pending review</strong> and is <strong>not treated as a confirmed fact</strong>.
          Moderators review reports before any approved summary appears publicly.
        </p>
        <div className="border border-border bg-tint/30 p-4 text-sm">
          <div className="space-y-1.5 font-mono text-[13px]">
            <div><span className="font-bold uppercase tracking-[0.1em] text-muted">Report ID · </span>{result.id}</div>
            <div><span className="font-bold uppercase tracking-[0.1em] text-muted">Moderation status · </span>{result.moderation_status}</div>
            {result.pii_warnings?.length ? (
              <div><span className="font-bold uppercase tracking-[0.1em] text-muted">PII warnings · </span>{result.pii_warnings.join(', ')}</div>
            ) : (
              <div className="text-muted">No PII warnings returned.</div>
            )}
          </div>
        </div>
        <div>
          <Link to="/reports" className={buttonClass('primary')}>Back to reports</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Masthead
        title="Submit a Community Report"
        subtitle="Share your experience to help others. Reports are reviewed by moderators before public display."
        aside={<Stamp lines={['Intake', 'form 7']} tone="ink" />}
      />

      <div className="flex items-start gap-3 border-l-2 border-warning bg-warning/10 px-4 py-3.5 text-sm leading-relaxed">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-warning" />
        <div>
          <p className="font-display font-bold text-heading">Redaction warning</p>
          <p className="mt-1 text-text">
            Please remove or mask personal/sensitive information (phone numbers, emails, ID numbers, bank/UPI/card
            details, OTPs, addresses). Do not share passwords or confidential documents.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6" noValidate>
        <Section title="The report" meta="required fields marked">
          <div className="space-y-4">
            <div>
              <label htmlFor="company" className={fieldLabelClass}>Company name <span aria-hidden="true">*</span></label>
              <input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} className={fieldClass} required />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="category" className={fieldLabelClass}>Category <span aria-hidden="true">*</span></label>
                <select id="category" value={form.category} onChange={(e) => set('category', e.target.value as ReportCategory)} className={fieldClass}>
                  {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="occurred" className={fieldLabelClass}>Approximate date (optional)</label>
                <input id="occurred" type="date" value={form.occurred_on || ''} onChange={(e) => set('occurred_on', e.target.value)} className={fieldClass} />
              </div>
              <div><label htmlFor="jobtitle" className={fieldLabelClass}>Job title (optional)</label><input id="jobtitle" value={form.job_title || ''} onChange={(e) => set('job_title', e.target.value)} className={fieldClass} /></div>
              <div><label htmlFor="joburl" className={fieldLabelClass}>Job URL (optional)</label><input id="joburl" value={form.job_url || ''} onChange={(e) => set('job_url', e.target.value)} className={fieldClass} /></div>
              <div className="md:col-span-2"><label htmlFor="recruiter" className={fieldLabelClass}>Recruiter identifier (optional)</label><input id="recruiter" value={form.recruiter_identifier || ''} onChange={(e) => set('recruiter_identifier', e.target.value)} className={fieldClass} placeholder="Name, email, phone, or profile link (avoid extra PII)" /></div>
            </div>

            <div>
              <label htmlFor="desc" className={fieldLabelClass}>Description <span aria-hidden="true">*</span></label>
              <textarea id="desc" value={form.description} onChange={(e) => set('description', e.target.value)} className={fieldClass} rows={8} minLength={30} maxLength={5000} required aria-describedby="desc-help pii-warn" />
              <div id="desc-help" className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
                <span>Minimum 30 characters. Describe what happened factually.</span>
                <span>{form.description.length}/5000</span>
              </div>
            </div>

            {piiWarnings.length > 0 && (
              <div id="pii-warn" role="alert" className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm">
                <p className="font-medium text-heading">Possible sensitive information detected: {piiWarnings.join(', ')}</p>
                <p className="mt-1 text-text">Consider masking or removing it before submitting.</p>
                <Button variant="secondary" size="sm" type="button" className="mt-2.5" onClick={() => set('description', maskPii(form.description))}>
                  Apply basic masking
                </Button>
              </div>
            )}

            <fieldset className="border border-border p-3.5">
              <legend className="px-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Optional flags</legend>
              <div className="space-y-2 text-sm text-text">
                <label className="flex items-center gap-2.5"><input type="checkbox" className="mt-0.5" checked={!!form.interacted} onChange={(e) => set('interacted', e.target.checked)} /> I interacted with this opportunity</label>
                <label className="flex items-center gap-2.5"><input type="checkbox" className="mt-0.5" checked={!!form.paid} onChange={(e) => set('paid', e.target.checked)} /> I paid money</label>
                <label className="flex items-center gap-2.5"><input type="checkbox" className="mt-0.5" checked={!!form.shared_info} onChange={(e) => set('shared_info', e.target.checked)} /> I shared personal/sensitive information</label>
              </div>
            </fieldset>
          </div>
        </Section>

        <Section title="Evidence upload (optional)" meta="text report always works">
          <p className="max-w-[68ch] text-sm leading-relaxed text-text">
            If evidence upload is available, provide only necessary files (images/PDF). Do not upload IDs, bank
            statements, or unnecessary personal data. Max size/type limits apply as shown by the service.
          </p>
          <p className="mt-2 text-xs text-muted">Evidence upload workflow may be limited in this environment; you can still submit a text report for review.</p>
        </Section>

        <Section title="Before you submit" meta="moderated">
          <p className="max-w-[68ch] text-sm leading-relaxed text-text">
            Your report will be marked <strong>pending review</strong> and is <strong>not treated as a confirmed fact</strong>.
            Public visibility happens only after moderator review and redaction where needed.
          </p>
          <label className="mt-3.5 flex items-start gap-2.5 text-sm text-text">
            <input type="checkbox" className="mt-1" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I understand this is a user-submitted report pending review, and I have removed/masked sensitive information where possible.</span>
          </label>
        </Section>

        {error && <ErrorState message={error} />}

        <Button type="submit" disabled={submitting} size="lg">
          {submitting ? 'Submitting…' : 'Submit report'}
        </Button>
      </form>
    </div>
  )
}

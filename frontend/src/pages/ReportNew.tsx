import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createReport, type ReportCategory, type ReportCreatePayload } from '../lib/api'
import { detectPii, maskPii } from '../lib/pii'
import { ErrorState } from '../components/ui/ErrorState'

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
      <div className="mx-auto max-w-2xl space-y-4 rounded-xl border border-border bg-surface p-6">
        <h1 className="text-2xl font-bold text-heading">Report submitted (pending review)</h1>
        <p className="text-sm">
          Thank you. Your submission is <strong>pending review</strong> and is <strong>not treated as a confirmed fact</strong>.
          Moderators review reports before any approved summary appears publicly.
        </p>
        <div className="rounded-lg border border-border bg-surface2/40 p-4 text-sm">
          <p><strong>Report ID:</strong> {result.id}</p>
          <p><strong>Moderation status:</strong> {result.moderation_status}</p>
          {result.pii_warnings?.length ? <p><strong>PII warnings:</strong> {result.pii_warnings.join(', ')}</p> : <p>No PII warnings returned.</p>}
        </div>
        <div className="flex gap-3">
          <Link to="/reports" className="rounded-lg bg-caramel px-4 py-2 font-semibold text-buttonText">Back to reports</Link>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-border bg-surface p-2.5 text-text'
  const labelCls = 'mb-1 block text-sm font-medium text-heading'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Submit a Community Report</h1>
        <p className="mt-2 text-muted">Share your experience to help others. Reports are reviewed by moderators before public display.</p>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm">
        <p className="font-medium text-heading">Redaction warning</p>
        <p>Please remove or mask personal/sensitive information (phone numbers, emails, ID numbers, bank/UPI/card details, OTPs, addresses). Do not share passwords or confidential documents.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6" noValidate>
        <div>
          <label htmlFor="company" className={labelCls}>Company name <span aria-hidden="true">*</span></label>
          <input id="company" value={form.company_name} onChange={(e) => set('company_name', e.target.value)} className={inputCls} required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="category" className={labelCls}>Category <span aria-hidden="true">*</span></label>
            <select id="category" value={form.category} onChange={(e) => set('category', e.target.value as ReportCategory)} className={inputCls}>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="occurred" className={labelCls}>Approximate date (optional)</label>
            <input id="occurred" type="date" value={form.occurred_on || ''} onChange={(e) => set('occurred_on', e.target.value)} className={inputCls} />
          </div>
          <div><label htmlFor="jobtitle" className={labelCls}>Job title (optional)</label><input id="jobtitle" value={form.job_title || ''} onChange={(e) => set('job_title', e.target.value)} className={inputCls} /></div>
          <div><label htmlFor="joburl" className={labelCls}>Job URL (optional)</label><input id="joburl" value={form.job_url || ''} onChange={(e) => set('job_url', e.target.value)} className={inputCls} /></div>
          <div className="md:col-span-2"><label htmlFor="recruiter" className={labelCls}>Recruiter identifier (optional)</label><input id="recruiter" value={form.recruiter_identifier || ''} onChange={(e) => set('recruiter_identifier', e.target.value)} className={inputCls} placeholder="Name, email, phone, or profile link (avoid extra PII)" /></div>
        </div>

        <div>
          <label htmlFor="desc" className={labelCls}>Description <span aria-hidden="true">*</span></label>
          <textarea id="desc" value={form.description} onChange={(e) => set('description', e.target.value)} className={inputCls} rows={8} minLength={30} maxLength={5000} required aria-describedby="desc-help pii-warn" />
          <div id="desc-help" className="mt-1 flex justify-between text-xs text-muted"><span>Minimum 30 characters. Describe what happened factually.</span><span>{form.description.length}/5000</span></div>
        </div>

        {piiWarnings.length > 0 && (
          <div id="pii-warn" role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
            <p className="font-medium text-heading">Possible sensitive information detected: {piiWarnings.join(', ')}</p>
            <p className="mt-1">Consider masking or removing it before submitting.</p>
            <button type="button" className="mt-2 rounded border border-border bg-surface px-3 py-1.5 text-sm" onClick={() => set('description', maskPii(form.description))}>
              Apply basic masking
            </button>
          </div>
        )}

        <fieldset className="rounded-lg border border-border p-3">
          <legend className="px-1 text-sm font-medium text-heading">Optional flags</legend>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.interacted} onChange={(e) => set('interacted', e.target.checked)} /> I interacted with this opportunity</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.paid} onChange={(e) => set('paid', e.target.checked)} /> I paid money</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!form.shared_info} onChange={(e) => set('shared_info', e.target.checked)} /> I shared personal/sensitive information</label>
          </div>
        </fieldset>

        <div className="rounded-lg border border-border bg-surface2/30 p-3 text-sm">
          <p className="font-medium text-heading">Evidence upload (optional)</p>
          <p className="text-muted">If evidence upload is available, provide only necessary files (images/PDF). Do not upload IDs, bank statements, or unnecessary personal data. Max size/type limits apply as shown by the service.</p>
          <p className="mt-1 text-xs text-muted">Evidence upload workflow may be limited in this environment; you can still submit a text report for review.</p>
        </div>

        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="font-medium text-heading">Before you submit</p>
          <p>Your report will be marked <strong>pending review</strong> and is <strong>not treated as a confirmed fact</strong>. Public visibility happens only after moderator review and redaction where needed.</p>
          <label className="mt-2 flex items-start gap-2">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span>I understand this is a user-submitted report pending review, and I have removed/masked sensitive information where possible.</span>
          </label>
        </div>

        {error && <ErrorState message={error} />}

        <button type="submit" disabled={submitting} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </form>
    </div>
  )
}
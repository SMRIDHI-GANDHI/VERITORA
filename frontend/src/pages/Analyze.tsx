import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  analyzeJob,
  analyzeMessage,
  analyzeOfferLetter,
  HttpError,
  scanUrl,
  type AnalysisResult,
  type JobAnalyzeRequest,
} from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { RiskBand } from '../components/ui/RiskBand'
import { MessageAnalysis } from '../components/MessageAnalysis'

type Tab = 'job' | 'url' | 'message' | 'offer'
type Message = { sender: string; text: string }

const TABS: readonly Tab[] = ['job', 'url', 'message', 'offer']

const TAB_TITLES: Record<Tab, string> = {
  job: 'Job analyzer',
  url: 'URL scanner',
  message: 'Message analyzer',
  offer: 'Offer letter analyzer',
}

function tabFromParam(value: string | null): Tab {
  return TABS.includes(value as Tab) ? (value as Tab) : 'job'
}

function AnalysisInline({ data }: { data: AnalysisResult }) {
  return (
    <section className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">Analysis result</h2>
          <p className="text-sm text-muted">{data.summary || 'Decision-support assessment.'}</p>
          <p className="mt-1 text-sm"><strong>Decision support, not a verdict.</strong></p>
        </div>
        <div className="text-right">
          <RiskBand band={data.risk_band} />
          {data.risk_band !== 'insufficient_information' && (
            <p className="mt-1 text-sm text-muted">Risk indicator: {data.risk_score ?? '—'} / 100</p>
          )}
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-heading">Risk factors</h3>
        {(data.risk_factors || []).length === 0 ? <p className="text-sm text-muted">No specific factors detected.</p> : (
          <ul className="space-y-2">
            {(data.risk_factors || []).map((f, i) => (
              <li key={f.evidence_key || i} className="rounded border border-border p-3 text-sm">
                <div className="flex flex-wrap gap-2"><span className="font-medium">{f.code}</span>{f.severity && <span className="rounded border border-border px-2 py-0.5 text-xs">Severity: {f.severity}</span>}{f.confidence && <span className="rounded border border-border px-2 py-0.5 text-xs">Confidence: {f.confidence}</span>}</div>
                {f.explanation && <p className="mt-1">{f.explanation}</p>}
                {f.evidence?.excerpt && <p className="mt-1 text-muted">Excerpt: {f.evidence.excerpt}</p>}
                {f.source?.type?.startsWith('message:') && <p className="mt-1 text-xs text-muted">Source: {f.source.type}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {(data.recommendations || []).length > 0 && (
        <div>
          <h3 className="mb-1 font-medium text-heading">Recommendations</h3>
          <ul className="list-disc pl-5 text-sm">{(data.recommendations || []).map((r, i) => <li key={r.code || i}>{r.code}</li>)}</ul>
        </div>
      )}
    </section>
  )
}

export function Analyze() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const prefill = location.state as { prefillDescription?: string; prefillUrl?: string } | null
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>(() => tabFromParam(searchParams.get('tab')))

  function selectTab(next: Tab) {
    setTab(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'job') params.delete('tab')
    else params.set('tab', next)
    setSearchParams(params, { replace: true })
  }

  // Job form
  const [form, setForm] = useState<JobAnalyzeRequest>({
    title: '', description: prefill?.prefillDescription || '', company_name: '', salary_text: '', experience_level: '', location: '', application_instructions: '', recruiter_contact: '', company_website: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // URL scan
  const [scanUrlValue, setScanUrlValue] = useState(prefill?.prefillUrl || '')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [scanResult, setScanResult] = useState<Record<string, unknown> | null>(null)

  // Message analyze
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'recruiter', text: '' },
  ])
  const [msgLoading, setMsgLoading] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)
  const [msgResult, setMsgResult] = useState<AnalysisResult | null>(null)
  const [msgAnalyzed, setMsgAnalyzed] = useState<Message[]>([])

  // Offer letter
  const [offerFile, setOfferFile] = useState<File | null>(null)
  const [offerConsent, setOfferConsent] = useState(false)
  const [offerKeep, setOfferKeep] = useState(false)
  const [offerLoading, setOfferLoading] = useState(false)
  const [offerError, setOfferError] = useState<string | null>(null)
  const [offerResult, setOfferResult] = useState<Record<string, unknown> | null>(null)

  function set<K extends keyof JobAnalyzeRequest>(key: K, value: JobAnalyzeRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!form.title || form.title.trim().length < 1) errs.title = 'Title is required.'
    if (!form.description || form.description.trim().length < 20) errs.description = 'Description must be at least 20 characters.'
    if (form.description && form.description.length > 20000) errs.description = 'Description must be 20000 characters or fewer.'
    return errs
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSubmitting(true)
    try {
      const payload: JobAnalyzeRequest = { title: form.title.trim(), description: form.description }
      ;(Object.keys(form) as (keyof JobAnalyzeRequest)[]).forEach((k) => {
        if (k === 'title' || k === 'description') return
        const v = form[k]
        if (typeof v === 'string' && v.trim()) (payload as Record<string, unknown>)[k] = v.trim()
      })
      const res = await analyzeJob(payload)
      navigate(`/analysis/${res.id}`)
    } catch (err) {
      if (err instanceof HttpError) setError(err.problem?.detail || err.message || 'Analysis failed. Please try again.')
      else setError('Analysis failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function onScan(e: FormEvent) {
    e.preventDefault()
    setScanError(null)
    setScanResult(null)
    if (!scanUrlValue.trim()) { setScanError('Please enter a URL.'); return }
    setScanLoading(true)
    try {
      const res = await scanUrl({ url: scanUrlValue.trim() })
      setScanResult(res)
      const fields = (res.extracted_fields || {}) as Record<string, unknown>
      // prefill editable form from extracted fields
      setForm((f) => ({
        ...f,
        title: typeof fields.title === 'string' ? fields.title : f.title,
        description: typeof fields.description === 'string' ? fields.description : f.description,
        company_name: typeof fields.company_name === 'string' ? fields.company_name : f.company_name,
        company_website: typeof fields.company_website === 'string' ? fields.company_website : (typeof fields.source_url === 'string' ? fields.source_url : f.company_website),
        location: typeof fields.location === 'string' ? fields.location : f.location,
        salary_text: typeof fields.salary_text === 'string' ? fields.salary_text : f.salary_text,
      }))
    } catch (err) {
      if (err instanceof HttpError) setScanError(err.problem?.detail || err.message)
      else setScanError('URL scan failed.')
    } finally {
      setScanLoading(false)
    }
  }

  async function onAnalyzeMessages(e: FormEvent) {
    e.preventDefault()
    setMsgError(null)
    setMsgResult(null)
    const valid = messages.filter((m) => m.text.trim().length > 0)
    if (valid.length === 0) { setMsgError('Add at least one message.'); return }
    setMsgLoading(true)
    try {
      const res = await analyzeMessage({ messages: valid })
      setMsgResult(res)
      setMsgAnalyzed(valid)
    } catch (err) {
      if (err instanceof HttpError) setMsgError(err.problem?.detail || err.message)
      else setMsgError('Message analysis failed.')
    } finally {
      setMsgLoading(false)
    }
  }

  async function onAnalyzeOffer(e: FormEvent) {
    e.preventDefault()
    setOfferError(null)
    setOfferResult(null)
    if (!offerFile) { setOfferError('Please select a file.'); return }
    const allowed = ['application/pdf', 'image/png', 'image/jpeg']
    const nameOk = /\.(pdf|png|jpg|jpeg)$/i.test(offerFile.name)
    if (!allowed.includes(offerFile.type) && !nameOk) {
      setOfferError('Unsupported file type. Allowed: PDF, PNG, JPG.')
      return
    }
    if (offerFile.size > 5 * 1024 * 1024) {
      setOfferError('File is too large (max 5 MB).')
      return
    }
    if (!offerConsent) {
      setOfferError('Explicit consent is required before uploading for analysis.')
      return
    }
    setOfferLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', offerFile)
      fd.append('consent', offerConsent ? 'true' : 'false')
      fd.append('keep_file', offerKeep ? 'true' : 'false')
      const res = await analyzeOfferLetter(fd)
      setOfferResult(res)
    } catch (err) {
      if (err instanceof HttpError) setOfferError(err.problem?.detail || err.message)
      else setOfferError('Offer letter analysis failed.')
    } finally {
      setOfferLoading(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-border bg-surface p-2.5 text-text'
  const labelCls = 'mb-1 block text-sm font-medium text-heading'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">{t(`analyze.pageTitle.${tab}`, TAB_TITLES[tab])}</h1>
        <p className="mt-2 text-muted">
          {t('analyze.intro', 'Paste job details, scan a public URL, or analyze a conversation for decision-support risk indicators.')}
        </p>
        <p className="mt-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-text">
          Privacy hint: do not paste passwords, OTPs, banking credentials, or unredacted ID numbers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ['job', 'Job details'],
          ['url', 'Scan URL'],
          ['message', 'Analyze message'],
          ['offer', 'Offer letter'],
        ] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => selectTab(k)} aria-pressed={tab === k} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab === k ? 'border-caramel bg-caramel/20 text-heading' : 'border-border bg-surface text-text'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'job' && (
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-surface p-6" noValidate>
          <div>
            <label htmlFor="title" className={labelCls}>Job title <span aria-hidden="true">*</span></label>
            <input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} maxLength={200} required aria-invalid={!!fieldErrors.title} />
            <div className="mt-1 flex justify-between text-xs text-muted"><span className={fieldErrors.title ? 'text-danger' : ''}>{fieldErrors.title || ''}</span><span>{form.title.length}/200</span></div>
          </div>
          <div>
            <label htmlFor="description" className={labelCls}>Job description <span aria-hidden="true">*</span></label>
            <textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} className={inputCls} rows={10} minLength={20} maxLength={20000} required aria-invalid={!!fieldErrors.description} />
            <div className="mt-1 flex justify-between text-xs text-muted"><span className={fieldErrors.description ? 'text-danger' : ''}>{fieldErrors.description || 'Minimum 20 characters.'}</span><span>{form.description.length}/20000</span></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><label htmlFor="company_name" className={labelCls}>Company name</label><input id="company_name" value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} className={inputCls} /></div>
            <div><label htmlFor="company_website" className={labelCls}>Company website</label><input id="company_website" value={form.company_website || ''} onChange={(e) => set('company_website', e.target.value)} className={inputCls} placeholder="https://..." /></div>
            <div><label htmlFor="salary_text" className={labelCls}>Salary</label><input id="salary_text" value={form.salary_text || ''} onChange={(e) => set('salary_text', e.target.value)} className={inputCls} /></div>
            <div><label htmlFor="experience_level" className={labelCls}>Experience level</label><input id="experience_level" value={form.experience_level || ''} onChange={(e) => set('experience_level', e.target.value)} className={inputCls} /></div>
            <div><label htmlFor="location" className={labelCls}>Location</label><input id="location" value={form.location || ''} onChange={(e) => set('location', e.target.value)} className={inputCls} /></div>
            <div><label htmlFor="recruiter_contact" className={labelCls}>Recruiter contact</label><input id="recruiter_contact" value={form.recruiter_contact || ''} onChange={(e) => set('recruiter_contact', e.target.value)} className={inputCls} /></div>
            <div className="md:col-span-2"><label htmlFor="application_instructions" className={labelCls}>Application instructions</label><textarea id="application_instructions" value={form.application_instructions || ''} onChange={(e) => set('application_instructions', e.target.value)} className={inputCls} rows={3} /></div>
          </div>
          {error && <ErrorState message={error} />}
          <button type="submit" disabled={submitting} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
            {submitting ? 'Analyzing…' : 'Analyze job'}
          </button>
        </form>
      )}

      {tab === 'url' && (
        <div className="space-y-4">
          <form onSubmit={onScan} className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div>
              <label htmlFor="scanurl" className={labelCls}>Public job posting URL</label>
              <input id="scanurl" value={scanUrlValue} onChange={(e) => setScanUrlValue(e.target.value)} className={inputCls} placeholder="https://..." />
            </div>
            <p className="text-sm text-muted">VERITORA only reads publicly accessible pages and respects site rules. Scripts are not executed.</p>
            {scanError && <ErrorState message={scanError} />}
            <button type="submit" disabled={scanLoading} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
              {scanLoading ? 'Scanning…' : 'Scan URL'}
            </button>
          </form>

          {scanResult && (
            <section className="space-y-3 rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-heading">Scan result</h2>
                <span className="rounded border border-border px-2 py-0.5 text-xs">Status: {String(scanResult.status || '')}</span>
                <span className="rounded border border-border px-2 py-0.5 text-xs">Extraction confidence: {String(scanResult.extraction_confidence || 'none')}</span>
              </div>
              {scanResult.blocked_reason ? <p className="text-sm"><strong>Reason:</strong> {String(scanResult.blocked_reason)}</p> : null}
              <p className="text-sm text-muted">{String(scanResult.notice || '')}</p>
              <p className="text-sm">{String(scanResult.manual_paste_fallback || '')}</p>
              {String(scanResult.status) === 'blocked' || String(scanResult.status) === 'limited' ? (
                <p className="rounded border border-warning/30 bg-warning/10 p-3 text-sm">If extraction is blocked or limited, paste the job details manually in the Job details tab and run analysis.</p>
              ) : null}

              <div className="rounded-lg border border-border bg-surface2/30 p-4">
                <h3 className="mb-2 font-medium text-heading">Extracted fields (editable)</h3>
                <p className="mb-3 text-sm text-muted">Review and edit these fields, then analyze. Editing updates the analysis request.</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><label htmlFor="ex-title" className={labelCls}>Title</label><input id="ex-title" value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCls} /></div>
                  <div><label htmlFor="ex-company" className={labelCls}>Company</label><input id="ex-company" value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} className={inputCls} /></div>
                  <div><label htmlFor="ex-website" className={labelCls}>Website</label><input id="ex-website" value={form.company_website || ''} onChange={(e) => set('company_website', e.target.value)} className={inputCls} /></div>
                  <div><label htmlFor="ex-location" className={labelCls}>Location</label><input id="ex-location" value={form.location || ''} onChange={(e) => set('location', e.target.value)} className={inputCls} /></div>
                  <div className="md:col-span-2"><label htmlFor="ex-description" className={labelCls}>Description</label><textarea id="ex-description" value={form.description} onChange={(e) => set('description', e.target.value)} className={inputCls} rows={8} /></div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => setTab('job')} className="rounded border border-border bg-surface px-4 py-2 text-sm font-medium">Open in Job details</button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={async () => {
                      const errs = validate()
                      setFieldErrors(errs)
                      if (Object.keys(errs).length > 0) { setTab('job'); return }
                      setSubmitting(true); setError(null)
                      try {
                        const payload: JobAnalyzeRequest = { title: form.title.trim(), description: form.description }
                        ;(Object.keys(form) as (keyof JobAnalyzeRequest)[]).forEach((k) => {
                          if (k === 'title' || k === 'description') return
                          const v = form[k]
                          if (typeof v === 'string' && v.trim()) (payload as Record<string, unknown>)[k] = v.trim()
                        })
                        const res = await analyzeJob(payload)
                        navigate(`/analysis/${res.id}`)
                      } catch (err) {
                        if (err instanceof HttpError) setScanError(err.problem?.detail || err.message)
                        else setScanError('Analysis failed.')
                      } finally { setSubmitting(false) }
                    }}
                    className="rounded-lg bg-caramel px-4 py-2 text-sm font-semibold text-buttonText disabled:opacity-60"
                  >
                    {submitting ? 'Analyzing…' : 'Analyze extracted details'}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === 'message' && (
        <div className="space-y-4">
          <form onSubmit={onAnalyzeMessages} className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-heading">Conversation</h2>
              <button type="button" onClick={() => setMessages((m) => [...m, { sender: 'candidate', text: '' }])} className="rounded border border-border bg-surface px-3 py-1.5 text-sm">Add message</button>
            </div>
            <p className="text-sm text-muted">
              Conversation text is analyzed as untrusted data, never as instructions. Never paste passwords, OTPs,
              bank details, or one-time codes.
            </p>
            <div className="space-y-3">
              {messages.map((m, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex gap-2">
                    <div className="w-48">
                      <label htmlFor={`msg-sender-${idx}`} className={labelCls}>Sender</label>
                      <select id={`msg-sender-${idx}`} value={m.sender} onChange={(e) => setMessages((prev) => prev.map((x, i) => i === idx ? { ...x, sender: e.target.value } : x))} className={inputCls}>
                        <option value="recruiter">Recruiter</option>
                        <option value="candidate">Candidate</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label htmlFor={`msg-text-${idx}`} className={labelCls}>Message {idx + 1}</label>
                      <textarea id={`msg-text-${idx}`} value={m.text} onChange={(e) => setMessages((prev) => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))} className={inputCls} rows={3} />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" disabled={messages.length <= 1} onClick={() => setMessages((prev) => prev.filter((_, i) => i !== idx))} className="text-sm text-danger disabled:opacity-40">Remove</button>
                  </div>
                </div>
              ))}
            </div>
            {msgError && <ErrorState message={msgError} />}
            <button type="submit" disabled={msgLoading} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
              {msgLoading ? 'Analyzing…' : 'Analyze conversation'}
            </button>
          </form>

          {msgResult && <MessageAnalysis messages={msgAnalyzed} data={msgResult} />}
        </div>
      )}

      {tab === 'offer' && (
        <div className="space-y-4">
          <form onSubmit={onAnalyzeOffer} className="space-y-4 rounded-xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold text-heading">Offer letter upload</h2>
            <p className="text-sm text-muted">Allowed types: PDF, PNG, JPG. Max size: 5 MB. Files are processed for extraction and analysis; avoid uploading unredacted sensitive documents if not necessary.</p>
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <strong>Redaction advice:</strong> Mask Aadhaar/PAN/passport numbers, bank details, signatures, and other sensitive identifiers before uploading when possible. Do not share passwords or OTPs.
            </div>
            <div>
              <label htmlFor="offer-file" className={labelCls}>Offer letter file</label>
              <input id="offer-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => setOfferFile(e.target.files?.[0] || null)} className={inputCls} />
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={offerConsent} onChange={(e) => setOfferConsent(e.target.checked)} />
              <span>I explicitly consent to upload this file for decision-support analysis. I understand no third-party AI processing is used unless separately enabled and consented.</span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={offerKeep} onChange={(e) => setOfferKeep(e.target.checked)} />
              <span>Keep the uploaded file after analysis (optional; default is delete after analysis).</span>
            </label>
            {offerError && <ErrorState message={offerError} />}
            {offerLoading && <p className="text-sm text-muted">Uploading and analyzing…</p>}
            <button type="submit" disabled={offerLoading} className="rounded-lg bg-caramel px-5 py-2.5 font-semibold text-buttonText disabled:opacity-60">
              {offerLoading ? 'Analyzing…' : 'Analyze offer letter'}
            </button>
          </form>

          {offerResult && (
            <section className="space-y-4 rounded-xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold text-heading">Extraction & analysis</h2>
              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div className="rounded border border-border p-3">
                  <h3 className="font-medium text-heading">Extraction preview</h3>
                  <div><strong>Status:</strong> {String(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.status || '—')}</div>
                  <div><strong>Confidence:</strong> {String(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.confidence ?? '—')}</div>
                  <div><strong>Method:</strong> {String(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.method || '—')}</div>
                </div>
                <div className="rounded border border-border p-3">
                  <h3 className="font-medium text-heading">Extracted fields</h3>
                  <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.fields || {}, null, 2)}</pre>
                </div>
              </div>
              {Array.isArray(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.notes) && (((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.notes as unknown[]).length > 0 && (
                <div className="rounded border border-border p-3 text-sm">
                  <strong>Notes:</strong>
                  <ul className="mt-1 list-disc pl-5">{((((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.notes) as string[]).map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
              )}
              {'risk_band' in offerResult && <AnalysisInline data={offerResult as unknown as AnalysisResult} />}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
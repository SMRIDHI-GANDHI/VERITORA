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
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'
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

/** Tabs are file dividers: one ink-blue row, the active tab filed forward. */
function TabRow({ tab, onSelect }: { tab: Tab; onSelect: (t: Tab) => void }) {
  const { t } = useTranslation()
  const labels: Array<[Tab, string]> = [
    ['job', t('analyze.tab.job', 'Job details')],
    ['url', t('analyze.tab.url', 'Scan URL')],
    ['message', t('analyze.tab.message', 'Analyze message')],
    ['offer', t('analyze.tab.offer', 'Offer letter')],
  ]
  return (
    <div className="flex flex-wrap gap-px border-b border-heading" role="group" aria-label="Analyzer">
      {labels.map(([k, label]) => (
        <button
          key={k}
          type="button"
          onClick={() => onSelect(k)}
          aria-pressed={tab === k}
          className={`-mb-px border-b-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
            tab === k
              ? 'border-stamp bg-tint/60 text-heading'
              : 'border-transparent text-muted hover:text-heading'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function AnalysisInline({ data }: { data: AnalysisResult }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-heading">Analysis result</h2>
          <p className="mt-1 text-sm text-muted">{data.summary || 'Decision-support assessment.'}</p>
          <p className="mt-2 text-sm text-text"><strong>Decision support, not a verdict.</strong></p>
        </div>
        <div className="flex items-center gap-4">
          <RiskBand band={data.risk_band} />
          {data.risk_band !== 'insufficient_information' && (
            <p className="font-mono text-[13px] text-muted">Risk indicator: {data.risk_score ?? '—'} / 100</p>
          )}
        </div>
      </div>
      <div>
        <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Risk factors</h3>
        {(data.risk_factors || []).length === 0 ? (
          <p className="text-sm text-muted">No specific factors detected.</p>
        ) : (
          <ul className="space-y-2">
            {(data.risk_factors || []).map((f, i) => (
              <li key={f.evidence_key || i} className="entry flex flex-wrap items-start justify-between gap-3 pb-3 text-sm">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-3 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-heading">
                    <span>{f.code}</span>
                    {f.severity && <span className="font-normal text-muted">Severity: {f.severity}</span>}
                    {f.confidence && <span className="font-normal text-muted">Confidence: {f.confidence}</span>}
                  </div>
                  {f.explanation && <p className="mt-1 text-text">{f.explanation}</p>}
                  {f.evidence?.excerpt && (
                    <p className="mt-1.5 border-l-2 border-stamp bg-stamp/[0.06] px-2 py-1 text-muted">{f.evidence.excerpt}</p>
                  )}
                  {f.source?.type?.startsWith('message:') && <p className="mt-1 font-mono text-[11px] text-muted">Source: {f.source.type}</p>}
                </div>
                <Stamp lines={[f.severity || 'noted']} tone={f.severity === 'high' ? 'stamp' : 'muted'} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {(data.recommendations || []).length > 0 && (
        <div>
          <h3 className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Recommendations</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-text">
            {(data.recommendations || []).map((r, i) => <li key={r.code || i}>{r.code}</li>)}
          </ul>
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

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Masthead
        title={t(`analyze.pageTitle.${tab}`, TAB_TITLES[tab])}
        subtitle={t('analyze.intro', 'Paste job details, scan a public URL, or analyze a conversation for decision-support risk indicators.')}
        aside={<Stamp lines={['Intake', 'form 0' + (TABS.indexOf(tab) + 1)]} tone="ink" />}
      />

      <p className="flex items-start gap-2.5 border border-warning/50 bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
        <Icon name="warning" size={16} className="mt-0.5 text-warning" />
        <span>Privacy hint: do not paste passwords, OTPs, banking credentials, or unredacted ID numbers.</span>
      </p>

      <TabRow tab={tab} onSelect={selectTab} />

      {tab === 'job' && (
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          <Section title="Job details" meta="required">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="title" className={fieldLabelClass}>Job title <span aria-hidden="true">*</span></label>
                <input id="title" value={form.title} onChange={(e) => set('title', e.target.value)} className={fieldClass} maxLength={200} required aria-invalid={!!fieldErrors.title} />
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
                  <span className={fieldErrors.title ? 'text-danger' : ''}>{fieldErrors.title || ''}</span>
                  <span>{form.title.length}/200</span>
                </div>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="description" className={fieldLabelClass}>Job description <span aria-hidden="true">*</span></label>
                <textarea id="description" value={form.description} onChange={(e) => set('description', e.target.value)} className={fieldClass} rows={10} minLength={20} maxLength={20000} required aria-invalid={!!fieldErrors.description} />
                <div className="mt-1.5 flex justify-between font-mono text-[11px] text-muted">
                  <span className={fieldErrors.description ? 'text-danger' : ''}>{fieldErrors.description || 'Minimum 20 characters.'}</span>
                  <span>{form.description.length}/20000</span>
                </div>
              </div>
              <div><label htmlFor="company_name" className={fieldLabelClass}>Company name</label><input id="company_name" value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} className={fieldClass} /></div>
              <div><label htmlFor="company_website" className={fieldLabelClass}>Company website</label><input id="company_website" value={form.company_website || ''} onChange={(e) => set('company_website', e.target.value)} className={fieldClass} placeholder="https://..." /></div>
              <div><label htmlFor="salary_text" className={fieldLabelClass}>Salary</label><input id="salary_text" value={form.salary_text || ''} onChange={(e) => set('salary_text', e.target.value)} className={fieldClass} /></div>
              <div><label htmlFor="experience_level" className={fieldLabelClass}>Experience level</label><input id="experience_level" value={form.experience_level || ''} onChange={(e) => set('experience_level', e.target.value)} className={fieldClass} /></div>
              <div><label htmlFor="location" className={fieldLabelClass}>Location</label><input id="location" value={form.location || ''} onChange={(e) => set('location', e.target.value)} className={fieldClass} /></div>
              <div><label htmlFor="recruiter_contact" className={fieldLabelClass}>Recruiter contact</label><input id="recruiter_contact" value={form.recruiter_contact || ''} onChange={(e) => set('recruiter_contact', e.target.value)} className={fieldClass} /></div>
              <div className="md:col-span-2"><label htmlFor="application_instructions" className={fieldLabelClass}>Application instructions</label><textarea id="application_instructions" value={form.application_instructions || ''} onChange={(e) => set('application_instructions', e.target.value)} className={fieldClass} rows={3} /></div>
            </div>
          </Section>
          {error && <ErrorState message={error} />}
          <Button type="submit" disabled={submitting} size="lg">
            {submitting ? 'Analyzing…' : 'Analyze job'}
          </Button>
        </form>
      )}

      {tab === 'url' && (
        <div className="space-y-6">
          <form onSubmit={onScan} className="space-y-4">
            <Section title="Scan URL" meta="public page only">
              <div>
                <label htmlFor="scanurl" className={fieldLabelClass}>Public job posting URL</label>
                <input id="scanurl" value={scanUrlValue} onChange={(e) => setScanUrlValue(e.target.value)} className={fieldClass} placeholder="https://..." />
              </div>
              <p className="mt-2 text-sm text-muted">VERITORA only reads publicly accessible pages and respects site rules. Scripts are not executed.</p>
              {scanError && <div className="mt-3"><ErrorState message={scanError} /></div>}
              <Button type="submit" disabled={scanLoading} className="mt-4">
                {scanLoading ? 'Scanning…' : 'Scan URL'}
              </Button>
            </Section>
          </form>

          {scanResult && (
            <Section
              title="Scan result"
              meta={String(scanResult.status || '')}
              action={
                <span className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
                  Confidence: {String(scanResult.extraction_confidence || 'none')}
                </span>
              }
            >
              <div className="space-y-4">
                {scanResult.blocked_reason ? <p className="text-sm text-text"><strong>Reason:</strong> {String(scanResult.blocked_reason)}</p> : null}
                <p className="text-sm text-muted">{String(scanResult.notice || '')}</p>
                <p className="text-sm text-text">{String(scanResult.manual_paste_fallback || '')}</p>
                {String(scanResult.status) === 'blocked' || String(scanResult.status) === 'limited' ? (
                  <p className="border-l-2 border-warning bg-warning/10 px-3 py-2 text-sm text-text">
                    If extraction is blocked or limited, paste the job details manually in the Job details tab and run analysis.
                  </p>
                ) : null}

                <div className="border border-border bg-tint/30 p-4">
                  <h3 className="mb-1 font-display text-[15px] font-bold text-heading">Extracted fields (editable)</h3>
                  <p className="mb-3 text-sm text-muted">Review and edit these fields, then analyze. Editing updates the analysis request.</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div><label htmlFor="ex-title" className={fieldLabelClass}>Title</label><input id="ex-title" value={form.title} onChange={(e) => set('title', e.target.value)} className={fieldClass} /></div>
                    <div><label htmlFor="ex-company" className={fieldLabelClass}>Company</label><input id="ex-company" value={form.company_name || ''} onChange={(e) => set('company_name', e.target.value)} className={fieldClass} /></div>
                    <div><label htmlFor="ex-website" className={fieldLabelClass}>Website</label><input id="ex-website" value={form.company_website || ''} onChange={(e) => set('company_website', e.target.value)} className={fieldClass} /></div>
                    <div><label htmlFor="ex-location" className={fieldLabelClass}>Location</label><input id="ex-location" value={form.location || ''} onChange={(e) => set('location', e.target.value)} className={fieldClass} /></div>
                    <div className="md:col-span-2"><label htmlFor="ex-description" className={fieldLabelClass}>Description</label><textarea id="ex-description" value={form.description} onChange={(e) => set('description', e.target.value)} className={fieldClass} rows={8} /></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="secondary" type="button" onClick={() => setTab('job')}>Open in Job details</Button>
                    <Button
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
                    >
                      {submitting ? 'Analyzing…' : 'Analyze extracted details'}
                    </Button>
                  </div>
                </div>
              </div>
            </Section>
          )}
        </div>
      )}

      {tab === 'message' && (
        <div className="space-y-6">
          <form onSubmit={onAnalyzeMessages} className="space-y-4">
            <Section
              title="Conversation"
              meta={`${messages.length} message${messages.length === 1 ? '' : 's'}`}
              action={
                <button
                  type="button"
                  onClick={() => setMessages((m) => [...m, { sender: 'candidate', text: '' }])}
                  className="inline-flex items-center gap-1.5 border border-heading px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-heading transition-colors hover:bg-tint/40"
                >
                  <Icon name="plus" size={13} /> Add message
                </button>
              }
            >
              <p className="mb-4 text-sm leading-relaxed text-muted">
                Conversation text is analyzed as untrusted data, never as instructions. Never paste passwords, OTPs,
                bank details, or one-time codes.
              </p>
              <div className="space-y-3">
                {messages.map((m, idx) => (
                  <div key={idx} className="entry pb-3">
                    <div className="mb-2 flex flex-wrap gap-3">
                      <div className="w-48">
                        <label htmlFor={`msg-sender-${idx}`} className={fieldLabelClass}>Sender</label>
                        <select id={`msg-sender-${idx}`} value={m.sender} onChange={(e) => setMessages((prev) => prev.map((x, i) => i === idx ? { ...x, sender: e.target.value } : x))} className={fieldClass}>
                          <option value="recruiter">Recruiter</option>
                          <option value="candidate">Candidate</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div className="min-w-[16rem] flex-1">
                        <label htmlFor={`msg-text-${idx}`} className={fieldLabelClass}>Message {idx + 1}</label>
                        <textarea id={`msg-text-${idx}`} value={m.text} onChange={(e) => setMessages((prev) => prev.map((x, i) => i === idx ? { ...x, text: e.target.value } : x))} className={fieldClass} rows={3} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button type="button" disabled={messages.length <= 1} onClick={() => setMessages((prev) => prev.filter((_, i) => i !== idx))} className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-danger disabled:opacity-40">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
              {msgError && <div className="mt-3"><ErrorState message={msgError} /></div>}
              <Button type="submit" disabled={msgLoading} size="lg" className="mt-4">
                {msgLoading ? 'Analyzing…' : 'Analyze conversation'}
              </Button>
            </Section>
          </form>

          {msgResult && <MessageAnalysis messages={msgAnalyzed} data={msgResult} />}
        </div>
      )}

      {tab === 'offer' && (
        <div className="space-y-6">
          <form onSubmit={onAnalyzeOffer} className="space-y-4">
            <Section title="Offer letter upload" meta="pdf · png · jpg · max 5 mb">
              <p className="mb-3 text-sm text-muted">
                Allowed types: PDF, PNG, JPG. Max size: 5 MB. Files are processed for extraction and analysis; avoid
                uploading unredacted sensitive documents if not necessary.
              </p>
              <div className="mb-4 border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
                <strong className="font-display">Redaction advice:</strong> Mask Aadhaar/PAN/passport numbers, bank
                details, signatures, and other sensitive identifiers before uploading when possible. Do not share
                passwords or OTPs.
              </div>
              <div>
                <label htmlFor="offer-file" className={fieldLabelClass}>Offer letter file</label>
                <input id="offer-file" type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => setOfferFile(e.target.files?.[0] || null)} className={fieldClass} />
              </div>
              <label className="mt-4 flex items-start gap-2.5 text-sm text-text">
                <input type="checkbox" className="mt-1" checked={offerConsent} onChange={(e) => setOfferConsent(e.target.checked)} />
                <span>I explicitly consent to upload this file for decision-support analysis. I understand no third-party AI processing is used unless separately enabled and consented.</span>
              </label>
              <label className="mt-2.5 flex items-start gap-2.5 text-sm text-text">
                <input type="checkbox" className="mt-1" checked={offerKeep} onChange={(e) => setOfferKeep(e.target.checked)} />
                <span>Keep the uploaded file after analysis (optional; default is delete after analysis).</span>
              </label>
              {offerError && <div className="mt-3"><ErrorState message={offerError} /></div>}
              {offerLoading && <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Uploading and analyzing…</p>}
              <Button type="submit" disabled={offerLoading} size="lg" className="mt-4">
                {offerLoading ? 'Analyzing…' : 'Analyze offer letter'}
              </Button>
            </Section>
          </form>

          {offerResult && (
            <Section title={'Extraction & analysis'} meta="filed">
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div className="border border-border p-3">
                  <h3 className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Extraction preview</h3>
                  <div className="space-y-1 text-text">
                    <div><strong>Status:</strong> {String(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.status || '—')}</div>
                    <div><strong>Confidence:</strong> {String(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.confidence ?? '—')}</div>
                    <div><strong>Method:</strong> {String(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.method || '—')}</div>
                  </div>
                </div>
                <div className="border border-border p-3">
                  <h3 className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Extracted fields</h3>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-tint/40 p-2 font-mono text-xs">{JSON.stringify(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.fields || {}, null, 2)}</pre>
                </div>
              </div>
              {Array.isArray(((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.notes) && (((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.notes as unknown[]).length > 0 && (
                <div className="mt-4 border border-border p-3 text-sm">
                  <strong className="font-display">Notes:</strong>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-text">{((((offerResult as Record<string, unknown>).extraction as Record<string, unknown> | undefined)?.notes) as string[]).map((n, i) => <li key={i}>{n}</li>)}</ul>
                </div>
              )}
              {'risk_band' in offerResult && <div className="mt-5"><AnalysisInline data={offerResult as unknown as AnalysisResult} /></div>}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiFetch } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'

type InputMethod = 'text' | 'url' | 'screenshot'
type RiskCategory = 'Lower concern' | 'Moderate concern' | 'High concern' | 'Insufficient information'

type Extracted = {
  job_title: string
  company_name: string
  recruiter_name: string
  recruiter_email: string
  salary: string
  location: string
  job_description: string
  application_link: string
}

type Finding = { title: string; detail: string; evidence?: string; status: 'ok' | 'warn' | 'risk' | 'info' }
type ModuleResult = { name: string; findings: Finding[]; summary: string }

const emptyExtracted: Extracted = {
  job_title: '', company_name: '', recruiter_name: '', recruiter_email: '', salary: '', location: '', job_description: '', application_link: ''
}

function RiskBadge({ category }: { category: RiskCategory }) {
  const tone = category === 'Lower concern' ? 'border-green text-green'
    : category === 'Moderate concern' ? 'border-warning text-warning'
    : category === 'High concern' ? 'border-stamp text-stamp'
    : 'border-border text-muted'
  const mark = category === 'Lower concern' ? 'checked'
    : category === 'Moderate concern' ? 'warning'
    : category === 'High concern' ? 'warning'
    : 'not-checked'
  return (
    <span className={`inline-flex items-center gap-2 border-2 px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[0.1em] ${tone}`}>
      <Icon name={mark as 'checked' | 'warning' | 'not-checked'} size={14} />
      {category}
    </span>
  )
}

/** A ruled passage of the scan file: serif heading, hairline, then the rows. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return <Section title={title}>{children}</Section>
}

export function TrustScan() {
  const { t } = useTranslation()
  const [method, setMethod] = useState<InputMethod>('text')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<Extracted>(emptyExtracted)
  const [processing, setProcessing] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [modules, setModules] = useState<ModuleResult[] | null>(null)
  const [overall, setOverall] = useState<{ score: number | null; category: RiskCategory; explanation: string } | null>(null)

  const canProcess = useMemo(() => {
    if (method === 'text') return text.trim().length > 0
    if (method === 'url') return /^https?:\/\//i.test(url.trim())
    return !!file
  }, [method, text, url, file])

  function onFile(f: File | null) {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function processInput() {
    setProcessError(null)
    if (method === 'text' && !text.trim()) { setProcessError('Please paste a job description.'); return }
    if (method === 'url' && !/^https?:\/\//i.test(url.trim())) { setProcessError('Please enter a valid http(s) URL.'); return }
    if (method === 'screenshot' && !file) { setProcessError('Please upload a screenshot.'); return }
    if (method === 'screenshot' && file) {
      const okType = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      if (!okType) { setProcessError('Unsupported file type. Please upload PNG, JPG, or WEBP.'); return }
      if (file.size > 10 * 1024 * 1024) { setProcessError('File is too large. Maximum size is 10 MB.'); return }
    }
    setProcessing(true)
    try {
      let next: Partial<Extracted> = {}
      if (method === 'text') {
        next = { job_description: text, job_title: extracted.job_title, company_name: extracted.company_name }
      } else if (method === 'url') {
        // attempt existing backend URL scan/extract; fall back gracefully
        try {
          const res = await apiFetch<Record<string, unknown>>('/scan/url', { method: 'POST', body: JSON.stringify({ url }) })
          next = {
            job_title: String(res?.title || ''),
            company_name: String(res?.company_name || res?.company || ''),
            salary: String(res?.salary || ''),
            location: String(res?.location || ''),
            job_description: String(res?.description || ''),
            application_link: String(res?.application_link || url),
            recruiter_email: String(res?.recruiter_contact || ''),
          }
        } catch {
          next = { application_link: url, job_description: '' }
        }
      } else if (file) {
        try {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('screenshot', file)
          const res = await fetch(`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000/api/v1'}/analyze/offer-letter`, {
            method: 'POST', body: fd, credentials: 'include'
          })
          if (res.ok) {
            const data = await res.json() as Record<string, unknown>
            next = { job_description: String(data?.extracted_text || data?.description || ''), job_title: String(data?.job_title || ''), company_name: String(data?.company_name || '') }
          } else {
            next = {}
          }
        } catch {
          next = {}
        }
      }
      setExtracted({ ...emptyExtracted, ...next, job_description: (next.job_description as string) || (method === 'text' ? text : extracted.job_description) })
    } finally {
      setProcessing(false)
    }
  }

  function infoFinding(title: string): Finding {
    return { title, detail: 'Not enough information', status: 'info' }
  }

  async function runVerification() {
    setAnalyzeError(null)
    setAnalyzing(true)
    try {
      const jobFindings: Finding[] = []
      const companyFindings: Finding[] = []
      const recruiterFindings: Finding[] = []
      const urlFindings: Finding[] = []
      let score: number | null = null
      let category: RiskCategory = 'Insufficient information'
      const explanations: string[] = []

      // Job verification
      if (extracted.job_description || extracted.job_title) {
        try {
          const res = await apiFetch<Record<string, unknown>>('/analyze/job', {
            method: 'POST',
            body: JSON.stringify({
              title: extracted.job_title || 'Untitled role',
              description: extracted.job_description || 'No description provided',
              company_name: extracted.company_name || undefined,
              salary_text: extracted.salary || undefined,
              location: extracted.location || undefined,
              recruiter_contact: extracted.recruiter_email || undefined,
              company_website: extracted.application_link || undefined,
            }),
          })
          score = typeof res?.risk_score === 'number' ? res.risk_score : null
          const band = res?.risk_band
          category = band === 'high_concern' || band === 'very_high_concern' ? 'High concern' : band === 'moderate' ? 'Moderate concern' : band === 'lower' ? 'Lower concern' : 'Insufficient information'
          const factors = Array.isArray(res?.risk_factors) ? res.risk_factors as Array<Record<string, unknown>> : []
          if (factors.length === 0) jobFindings.push({ title: 'Job analysis', detail: 'No warning signs detected from available information.', status: 'ok' })
          for (const f of factors) {
            const evidence = f.evidence as Record<string, unknown> | undefined
            jobFindings.push({ title: String(f.code || 'Finding'), detail: String(f.explanation || 'Warning sign detected.'), evidence: evidence?.excerpt ? String(evidence.excerpt) : undefined, status: f.severity === 'high' ? 'risk' : f.severity === 'medium' ? 'warn' : 'info' })
          }
          explanations.push(String(res?.summary || 'Job analysis completed based on available information.'))
        } catch {
          jobFindings.push(infoFinding('Job analysis'))
        }
      } else {
        jobFindings.push(infoFinding('Job description'))
      }

      // Company verification
      if (extracted.company_name) {
        try {
          const res = await apiFetch<Record<string, unknown>>('/verify/company', {
            method: 'POST',
            body: JSON.stringify({ company_name: extracted.company_name, website: extracted.application_link || undefined, email_domain: extracted.recruiter_email?.split('@')[1] || undefined }),
          })
          const checks = Array.isArray(res?.checks) ? res.checks as Array<Record<string, unknown>> : []
          if (checks.length === 0) companyFindings.push(infoFinding('Company checks'))
          for (const c of checks) {
            const st = c.status === 'mismatch' ? 'risk' : c.status === 'consistent' || c.status === 'information_found' ? 'ok' : c.status === 'inconclusive' ? 'warn' : 'info'
            companyFindings.push({ title: String(c.check_type || 'Company check'), detail: String(c.status || 'Not enough information').replace(/_/g, ' '), evidence: c.source_url ? String(c.source_url) : undefined, status: st })
          }
        } catch {
          companyFindings.push(infoFinding('Company verification'))
        }
      } else {
        companyFindings.push(infoFinding('Company name'))
      }

      // Recruiter verification
      if (extracted.recruiter_name || extracted.recruiter_email) {
        try {
          const res = await apiFetch<Record<string, unknown>>('/verify/recruiter', {
            method: 'POST',
            body: JSON.stringify({ name: extracted.recruiter_name || 'Unknown', claimed_company: extracted.company_name || undefined, email: extracted.recruiter_email || undefined }),
          })
          const checks = Array.isArray(res?.checks) ? res.checks as Array<Record<string, unknown>> : []
          if (checks.length === 0) recruiterFindings.push(infoFinding('Recruiter checks'))
          for (const c of checks) {
            const st = c.status === 'mismatch' ? 'risk' : c.status === 'consistent' ? 'ok' : c.status === 'inconclusive' ? 'warn' : 'info'
            recruiterFindings.push({ title: String(c.check_type || 'Recruiter check'), detail: String(c.status || 'Not enough information').replace(/_/g, ' '), evidence: c.source_url ? String(c.source_url) : undefined, status: st })
          }
        } catch {
          recruiterFindings.push(infoFinding('Recruiter verification'))
        }
      } else {
        recruiterFindings.push(infoFinding('Recruiter details'))
      }

      // URL verification
      const targetUrl = extracted.application_link || (method === 'url' ? url : '')
      if (targetUrl && /^https?:\/\//i.test(targetUrl)) {
        try {
          const res = await apiFetch<Record<string, unknown>>('/scan/url', { method: 'POST', body: JSON.stringify({ url: targetUrl }) })
          if (res?.error || res?.status === 'inconclusive') urlFindings.push({ title: 'URL scan', detail: 'Not enough information', status: 'info' })
          else urlFindings.push({ title: 'URL scan', detail: 'URL processed. Review findings for details.', status: 'ok' })
        } catch {
          urlFindings.push(infoFinding('URL verification'))
        }
      } else {
        urlFindings.push(infoFinding('Destination URL'))
      }

      setModules([
        { name: 'Job Verification', findings: jobFindings, summary: 'Analysis of job description, language, compensation claims, payment requests, and application requirements.' },
        { name: 'Company Verification', findings: companyFindings, summary: 'Checks for available website, domain, registration, contact, and identity consistency signals.' },
        { name: 'Recruiter Verification', findings: recruiterFindings, summary: 'Checks for recruiter identity claims, email domain, company association, profile, and contact consistency.' },
        { name: 'URL Verification', findings: urlFindings, summary: 'Checks for destination URL, domain reputation, suspicious redirects, and available URL intelligence.' },
      ])
      setOverall({
        score,
        category,
        explanation: explanations.join(' ') || 'Assessment based on available information. Missing information is shown as not enough information and is not treated as fraud.'
      })
    } catch {
      setAnalyzeError('Verification could not be completed. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="space-y-8">
      <Masthead
        title={t('trustscan.title')}
        subtitle={t('trustscan.subtitle')}
        aside={<Stamp lines={['Trust scan', 'multi-check']} tone="ink" />}
      />
      <p className="max-w-3xl text-[15px] leading-relaxed text-text">{t('trustscan.description')}</p>

      <Block title="Input method">
        <div className="mb-4 flex flex-wrap gap-px border-b border-heading">
          {([
            ['text', 'Paste Job Description'],
            ['url', 'Enter Job URL'],
            ['screenshot', 'Upload Screenshot'],
          ] as [InputMethod, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setMethod(k)} aria-pressed={method === k} className={`-mb-px border-b-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${method === k ? 'border-stamp bg-tint/60 text-heading' : 'border-transparent text-muted hover:text-heading'}`}>
              {label}
            </button>
          ))}
        </div>
        {method === 'text' && (
          <div>
            <label htmlFor="ts-text" className={fieldLabelClass}>Job description</label>
            <textarea id="ts-text" value={text} onChange={(e) => setText(e.target.value)} rows={10} className={fieldClass} placeholder="Paste the complete job description here..." />
          </div>
        )}
        {method === 'url' && (
          <div>
            <label htmlFor="ts-url" className={fieldLabelClass}>Job URL</label>
            <input id="ts-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} className={fieldClass} placeholder="https://..." />
            <p className="mt-1 text-xs text-muted">Only public http(s) URLs are processed using existing backend safeguards.</p>
          </div>
        )}
        {method === 'screenshot' && (
          <div className="space-y-3">
            <label htmlFor="ts-file" className={fieldLabelClass}>Upload screenshot</label>
            <div className="border border-dashed border-border bg-tint/30 p-6 text-center">
              <input id="ts-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0] || null)} className="mx-auto block text-sm" />
              <p className="mt-2 text-xs text-muted">PNG, JPG, or WEBP. Max 10 MB.</p>
            </div>
            {preview && <img src={preview} alt="Uploaded screenshot preview" className="max-h-64 border border-border" />}
          </div>
        )}
        {processError && <p role="alert" className="mt-3 text-sm text-danger">{processError}</p>}
        <div className="mt-4">
          <Button type="button" onClick={processInput} disabled={!canProcess || processing} size="lg">
            {processing ? 'Processing...' : 'Process input'}
          </Button>
        </div>
      </Block>

      <Block title="Extracted job information (review and edit)">
        <p className="mb-4 text-sm text-muted">Review and correct extracted information before running verification. Missing information is not invented.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {([
            ['job_title', 'Job title'],
            ['company_name', 'Company name'],
            ['recruiter_name', 'Recruiter name'],
            ['recruiter_email', 'Recruiter email'],
            ['salary', 'Salary'],
            ['location', 'Location'],
            ['application_link', 'Application link'],
          ] as [keyof Extracted, string][]).map(([key, label]) => (
            <div key={key}>
              <label htmlFor={`ex-${key}`} className={fieldLabelClass}>{label}</label>
              <input id={`ex-${key}`} value={extracted[key]} onChange={(e) => setExtracted({ ...extracted, [key]: e.target.value })} className={fieldClass} />
            </div>
          ))}
          <div className="md:col-span-2">
            <label htmlFor="ex-desc" className={fieldLabelClass}>Job description</label>
            <textarea id="ex-desc" rows={6} value={extracted.job_description} onChange={(e) => setExtracted({ ...extracted, job_description: e.target.value })} className={fieldClass} />
          </div>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={runVerification} disabled={analyzing} size="lg">
            {analyzing ? 'Running verification...' : 'Run TrustScan verification'}
          </Button>
        </div>
      </Block>

      {analyzing && <Skeleton className="h-40 w-full" />}
      {analyzeError && <ErrorState message={analyzeError} onRetry={runVerification} />}

      {overall && modules && (
        <div className="space-y-6">
          <Block title="Overall assessment">
            <div className="flex flex-wrap items-center gap-4">
              <RiskBadge category={overall.category} />
              <p className="text-sm text-muted">Risk score: {overall.score ?? 'Not enough information'}</p>
            </div>
            <p className="mt-3 text-sm">{overall.explanation}</p>
            <p className="mt-2 text-xs text-muted">AI-generated risk assessments are decision support and are distinct from independently verified facts. Absence of detected warning signs does not confirm legitimacy.</p>
          </Block>

          <div className="grid gap-4 md:grid-cols-2">
            {modules.map((m) => (
              <Block key={m.name} title={m.name}>
                <p className="mb-3 text-sm text-muted">{m.summary}</p>
                <ul className="space-y-2">
                  {m.findings.map((f, i) => (
                    <li key={i} className="entry pb-3 text-sm">
                      <p className="font-medium text-heading">{f.title}</p>
                      <p className="text-text">{f.detail}</p>
                      {f.evidence && <p className="mt-1 break-all text-xs text-muted">Evidence: {f.evidence}</p>}
                    </li>
                  ))}
                </ul>
              </Block>
            ))}
          </div>

          <Block title="Recommended next steps">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              <li>Independently verify the company through its official website and contact channels.</li>
              <li>Do not pay fees or share sensitive information (passwords, OTPs, banking details) to obtain a job.</li>
              <li>Treat unavailable information as unknown, not as proof of safety or fraud.</li>
              <li>Use official cybercrime reporting channels if you suspect fraud or financial loss.</li>
            </ul>
          </Block>

          <Block title="Actions">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" type="button" onClick={() => alert('Save analysis: connect to backend when available.')}>Save analysis</Button>
              <Button variant="secondary" type="button" onClick={() => window.print()}>Download report</Button>
              <Button variant="secondary" type="button" onClick={() => { window.location.href = '/reports/new' }}>Submit community report</Button>
              <Button type="button" onClick={() => { window.location.href = '/dashboard' }}>Return to dashboard</Button>
            </div>
            <p className="mt-3 text-xs text-muted">Actions use existing routes/backend where available; unavailable operations are indicated clearly.</p>
          </Block>
        </div>
      )}
    </div>
  )
}
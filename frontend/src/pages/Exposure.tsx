import { useMemo, useState } from 'react'
import { checkDataExposure, type DataExposureItem } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'

const CHECKLIST = [
  'Full name',
  'Email address',
  'Phone number',
  'Home address',
  'Date of birth',
  'Aadhaar number',
  'PAN number',
  'Passport number',
  'Bank account number',
  'IFSC code',
  'UPI ID',
  'Password',
  'OTP',
  'Resume/CV details',
  'Photo ID copy',
]

const CATEGORY_LABELS: Record<string, string> = {
  ordinary: 'Ordinary job information',
  contact: 'Contact information',
  identity: 'Government / identity ID',
  financial: 'Financial / banking details',
  credentials: 'Credentials / OTP',
  other_sensitive: 'Other sensitive personal data',
}

export function Exposure() {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [result, setResult] = useState<{
    items: DataExposureItem[]
    has_high_risk: boolean
    hard_warning_message?: string | null
    guidance: string[]
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const items = useMemo(() => {
    const fromChecks = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)
    const fromText = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
    return Array.from(new Set([...fromChecks, ...fromText]))
  }, [selected, text])

  async function onCheck() {
    setLoading(true)
    setError(null)
    try {
      const res = await checkDataExposure({ items })
      setResult(res)
    } catch {
      setError('Unable to check data exposure right now.')
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    const m = new Map<string, DataExposureItem[]>()
    for (const it of result?.items || []) {
      const cat = it.category || it.categories?.[0] || 'other_sensitive'
      const arr = m.get(cat) || []
      arr.push(it)
      m.set(cat, arr)
    }
    return Array.from(m.entries())
  }, [result])

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Data exposure checker</h1>
        <p className="mt-2 text-muted">Check whether requested information may be unnecessary, sensitive, or risky to share at this stage. Decision support only.</p>
      </div>

      <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-heading">
        <strong>Do not upload documents here.</strong> Do not paste or share passwords, OTPs, banking credentials, or unredacted ID/financial documents. If you already shared sensitive credentials, change them and contact official support channels immediately.
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
        <h2 className="text-lg font-semibold text-heading">What are they asking for?</h2>
        <div>
          <h3 className="mb-2 font-medium text-heading">Checklist</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHECKLIST.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!selected[c]} onChange={(e) => setSelected((s) => ({ ...s, [c]: e.target.checked }))} />
                {c}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="exposure-text" className="mb-1 block text-sm font-medium">Or paste requested items (one per line or comma-separated)</label>
          <textarea id="exposure-text" value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-lg border border-border bg-surface p-2.5" rows={4} placeholder="e.g. Aadhaar number, bank statement, OTP" />
        </div>
        <p className="text-xs text-muted">Client-side guidance: redact/mask sensitive values before sharing anywhere else. This tool classifies item types; avoid entering actual secret values.</p>
        <button type="button" onClick={onCheck} disabled={loading || items.length === 0} className="rounded-lg bg-caramel px-4 py-2 font-semibold text-buttonText disabled:opacity-50">{loading ? 'Checking…' : 'Check exposure'}</button>
        {items.length === 0 && <p className="text-xs text-muted">Select or enter at least one item.</p>}
      </section>

      {error && <ErrorState message={error} />}

      {result && (
        <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
          <h2 className="text-lg font-semibold text-heading">Results</h2>
          {result.has_high_risk && (
            <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm">
              <strong>High-risk request detected.</strong>{' '}
              {result.hard_warning_message ||
                'Passwords, OTPs, banking credentials, or highly sensitive identifiers should not be shared in recruitment processes.'}
            </div>
          )}
          {grouped.length === 0 ? <p className="text-sm text-muted">No items classified.</p> : (
            <div className="space-y-4">
              {grouped.map(([cat, arr]) => (
                <div key={cat} className="rounded-lg border border-border p-3">
                  <h3 className="font-medium text-heading">
                    {CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}
                  </h3>
                  <div className="mt-2 space-y-3">
                    {arr.map((it, idx) => (
                      <div key={idx} className="rounded border border-border bg-surface2/20 p-3 text-sm">
                        <div><strong>Item:</strong> {it.item}</div>
                        {it.warning && <div className="mt-1 text-danger"><strong>Warning:</strong> {it.warning}</div>}
                        {it.necessity_by_stage && (
                          <div className="mt-1"><strong>When it may be needed:</strong> {it.necessity_by_stage}</div>
                        )}
                        <div className="mt-1">
                          <strong>Why it may be unnecessary/risky:</strong>{' '}
                          {it.why_may_be_unnecessary ||
                            it.necessity?.why_may_be_unnecessary ||
                            'May not be needed at an early stage.'}
                        </div>
                        <div className="mt-1">
                          <strong>Safer alternatives:</strong>
                          <ul className="mt-1 list-disc pl-5">
                            {(it.safer_alternatives?.length
                              ? it.safer_alternatives
                              : it.safer_alternative
                                ? [it.safer_alternative]
                                : []
                            ).map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {result.guidance?.length > 0 && (
            <div>
              <h3 className="font-medium text-heading">Guidance</h3>
              <ul className="mt-1 list-disc pl-5 text-sm">{result.guidance.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

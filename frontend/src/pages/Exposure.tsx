import { useMemo, useState } from 'react'
import { checkDataExposure, type DataExposureItem } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'

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
    <div className="mx-auto max-w-5xl space-y-8">
      <Masthead
        title="Data exposure checker"
        subtitle="Check whether requested information may be unnecessary, sensitive, or risky to share at this stage. Decision support only."
        aside={<Stamp lines={['Privacy', 'intake']} tone="ink" />}
      />

      <div role="alert" className="flex items-start gap-3 border-2 border-danger bg-danger/10 px-4 py-3.5 text-sm leading-relaxed text-heading">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-danger" />
        <span>
          <strong className="font-display">Do not upload documents here.</strong> Do not paste or share passwords, OTPs,
          banking credentials, or unredacted ID/financial documents. If you already shared sensitive credentials, change
          them and contact official support channels immediately.
        </span>
      </div>

      <Section title="What are they asking for?" meta="select or paste">
        <div className="space-y-5">
          <div>
            <h3 className="mb-2.5 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Checklist</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST.map((c) => (
                <label key={c} className="flex items-center gap-2.5 border-b border-dotted border-border py-1.5 text-sm text-text">
                  <input type="checkbox" className="shrink-0" checked={!!selected[c]} onChange={(e) => setSelected((s) => ({ ...s, [c]: e.target.checked }))} />
                  {c}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="exposure-text" className={fieldLabelClass}>Or paste requested items (one per line or comma-separated)</label>
            <textarea id="exposure-text" value={text} onChange={(e) => setText(e.target.value)} className={fieldClass} rows={4} placeholder="e.g. Aadhaar number, bank statement, OTP" />
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Client-side guidance: redact/mask sensitive values before sharing anywhere else. This tool classifies item
            types; avoid entering actual secret values.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button type="button" onClick={onCheck} disabled={loading || items.length === 0}>
              {loading ? 'Checking…' : 'Check exposure'}
            </Button>
            {items.length === 0 && <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Select or enter at least one item.</p>}
          </div>
        </div>
      </Section>

      {error && <ErrorState message={error} />}

      {result && (
        <Section title="Results" meta={`${result.items.length} classified`}>
          <div className="space-y-5">
            {result.has_high_risk && (
              <div role="alert" className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm leading-relaxed">
                <strong className="font-display">High-risk request detected.</strong>{' '}
                {result.hard_warning_message ||
                  'Passwords, OTPs, banking credentials, or highly sensitive identifiers should not be shared in recruitment processes.'}
              </div>
            )}
            {grouped.length === 0 ? (
              <p className="text-sm text-muted">No items classified.</p>
            ) : (
              <div className="space-y-6">
                {grouped.map(([cat, arr]) => (
                  <div key={cat}>
                    <h3 className="border-b border-border pb-2 font-display text-[15px] font-bold text-heading">
                      {CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ')}
                    </h3>
                    <div className="mt-3 space-y-3">
                      {arr.map((it, idx) => (
                        <div key={idx} className="entry pb-3 text-sm">
                          <div className="text-text"><strong className="font-display">Item:</strong> {it.item}</div>
                          {it.warning && <div className="mt-1 text-danger"><strong className="font-display">Warning:</strong> {it.warning}</div>}
                          {it.necessity_by_stage && (
                            <div className="mt-1 text-text"><strong className="font-display">When it may be needed:</strong> {it.necessity_by_stage}</div>
                          )}
                          <div className="mt-1 text-text">
                            <strong className="font-display">Why it may be unnecessary/risky:</strong>{' '}
                            {it.why_may_be_unnecessary ||
                              it.necessity?.why_may_be_unnecessary ||
                              'May not be needed at an early stage.'}
                          </div>
                          <div className="mt-1 text-text">
                            <strong className="font-display">Safer alternatives:</strong>
                            <ul className="mt-1 list-disc space-y-0.5 pl-5">
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
              <div className="border-t border-border pt-4">
                <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Guidance</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-text">{result.guidance.map((g, i) => <li key={i}>{g}</li>)}</ul>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}

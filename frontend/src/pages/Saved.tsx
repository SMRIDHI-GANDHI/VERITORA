import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSaved, listSaved, type SavedOpportunity } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'

export function Saved() {
  const [items, setItems] = useState<SavedOpportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [analysisId, setAnalysisId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await listSaved()
      setItems(res.items || [])
    } catch {
      setError('Unable to load saved opportunities.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function onSave() {
    setSaving(true)
    try {
      await createSaved({ title: title || undefined, analysis_id: analysisId || undefined, notes: notes || undefined })
      setTitle(''); setAnalysisId(''); setNotes('')
      await load()
    } catch {
      setError('Unable to save opportunity.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <Masthead
        title="Saved opportunities"
        subtitle="Track opportunities you want to revisit. This is for your reference, not a verdict."
        aside={<Stamp lines={['Folio', `${items.length} held`]} tone="ink" />}
      />

      <Section title="Save an opportunity" meta="new entry">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void onSave()
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="saved-title" className={fieldLabelClass}>Title</label>
              <input id="saved-title" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="saved-analysis" className={fieldLabelClass}>Analysis ID (optional)</label>
              <input id="saved-analysis" value={analysisId} onChange={(e) => setAnalysisId(e.target.value)} className={fieldClass} placeholder="UUID" />
            </div>
          </div>
          <div>
            <label htmlFor="saved-notes" className={fieldLabelClass}>Notes</label>
            <textarea id="saved-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} rows={3} />
          </div>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </form>
      </Section>

      <Section title="Saved list" meta={`${items.length} filed`}>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : error ? (
          <ErrorState message={error} />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">No saved opportunities yet.</p>
        ) : (
          <ul>
            {items.map((i) => (
              <li key={i.id} className="entry pb-4">
                <div className="font-display text-[15px] font-bold text-heading">{i.title || 'Untitled opportunity'}</div>
                {i.analysis_id && (
                  <div className="mt-1 text-sm text-text">
                    Analysis: <Link className="text-accent underline underline-offset-4" to={`/analysis/${i.analysis_id}`}>{i.analysis_id}</Link>
                  </div>
                )}
                {i.notes && <p className="mt-1.5 text-sm leading-relaxed text-muted whitespace-pre-wrap">{i.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

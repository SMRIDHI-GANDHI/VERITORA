import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSaved, listSaved, type SavedOpportunity } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Saved opportunities</h1>
        <p className="mt-2 text-muted">Track opportunities you want to revisit. This is for your reference, not a verdict.</p>
      </div>

      <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
        <h2 className="text-lg font-semibold text-heading">Save an opportunity</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="saved-title" className="mb-1 block text-sm font-medium">Title</label>
            <input id="saved-title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full rounded-lg border border-border bg-surface p-2.5" />
          </div>
          <div>
            <label htmlFor="saved-analysis" className="mb-1 block text-sm font-medium">Analysis ID (optional)</label>
            <input id="saved-analysis" value={analysisId} onChange={(e) => setAnalysisId(e.target.value)} className="w-full rounded-lg border border-border bg-surface p-2.5" placeholder="UUID" />
          </div>
        </div>
        <div>
          <label htmlFor="saved-notes" className="mb-1 block text-sm font-medium">Notes</label>
          <textarea id="saved-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-border bg-surface p-2.5" rows={3} />
        </div>
        <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-caramel px-4 py-2 font-semibold text-buttonText disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-lg font-semibold text-heading">Saved list</h2>
        {loading ? <Skeleton className="h-24 w-full" /> : error ? <ErrorState message={error} /> : items.length === 0 ? <p className="text-sm text-muted">No saved opportunities yet.</p> : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="rounded-lg border border-border p-3">
                <div className="font-medium text-heading">{i.title || 'Untitled opportunity'}</div>
                {i.analysis_id && <div className="mt-1 text-sm">Analysis: <Link className="text-accent underline" to={`/analysis/${i.analysis_id}`}>{i.analysis_id}</Link></div>}
                {i.notes && <p className="mt-1 text-sm text-muted whitespace-pre-wrap">{i.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

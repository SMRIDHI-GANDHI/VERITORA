import { useEffect, useMemo, useState } from 'react'
import {
  adminCreateWatchlist,
  adminListWatchlist,
  adminUpdateWatchlist,
  getPublicWatchlistStatus,
  type WatchlistEntryItem,
} from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Skeleton } from '../components/ui/Skeleton'
import { Stamp } from '../components/ui/Stamp'

const transitions: Record<string, string[]> = {
  unverified_signal: ['under_review', 'cleared'],
  under_review: ['confirmed_pattern', 'cleared'],
  confirmed_pattern: ['cleared', 'under_review'],
  cleared: ['under_review'],
}

export function AdminWatchlist() {
  const [items, setItems] = useState<WatchlistEntryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmElevated, setConfirmElevated] = useState(false)

  const [newRef, setNewRef] = useState('')
  const [newReason, setNewReason] = useState('')
  const [newEvidence, setNewEvidence] = useState('')
  const [creating, setCreating] = useState(false)

  const [publicPreview, setPublicPreview] = useState<string>('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminListWatchlist()
      setItems(res.items || [])
    } catch {
      setError('Unable to load watchlist entries.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId])
  const allowed = selected ? (transitions[selected.status] || []) : []

  useEffect(() => {
    setActionStatus(allowed[0] || '')
    setActionReason('')
    setConfirmElevated(false)
    setActionError(null)
    if (selected?.entity_reference) {
      getPublicWatchlistStatus(selected.entity_reference)
        .then((r) => {
          if (!r.items?.length) setPublicPreview('No public flag shown (neutral).')
          else setPublicPreview(JSON.stringify(r.items, null, 2))
        })
        .catch(() => setPublicPreview('Unable to load public preview.'))
    } else {
      setPublicPreview('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, selected?.status])

  async function createEntry() {
    if (!newRef.trim()) return
    setCreating(true)
    try {
      await adminCreateWatchlist({
        entity_reference: newRef.trim(),
        status: 'unverified_signal',
        reason: newReason.trim() || undefined,
        evidence_reference: newEvidence.trim() || undefined,
      })
      setNewRef('')
      setNewReason('')
      setNewEvidence('')
      await load()
    } catch {
      setError('Failed to create watchlist entry.')
    } finally {
      setCreating(false)
    }
  }

  async function applyTransition() {
    if (!selected || !actionStatus) return
    setActionError(null)
    if (actionReason.trim().length < 3) {
      setActionError('Reason is required for status transitions (min 3 chars).')
      return
    }
    if (actionStatus === 'confirmed_pattern' && !confirmElevated) {
      setActionError('Moderator approval confirmation is required for elevated status.')
      return
    }
    setSaving(true)
    try {
      const updated = await adminUpdateWatchlist(selected.id, {
        status: actionStatus,
        reason: actionReason.trim(),
      })
      setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)))
      setActionReason('')
      setConfirmElevated(false)
    } catch {
      setActionError('Transition failed. Check permissions and allowed transitions.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Masthead
        title="Watchlist manager"
        subtitle="Manage internal watchlist entries with evidence-backed, auditable transitions. Public view must remain neutral."
        aside={<Stamp lines={['Internal', 'watchlist']} tone="ink" />}
      />

      <div role="note" className="border border-border bg-tint/30 p-4 text-sm">
        <strong>Public wording rule:</strong> Public surfaces may only show neutral flags (e.g. "additional verification recommended"), never internal labels, reasons, or evidence.
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="border border-border p-4 space-y-4">
          <h2 className="font-display text-[17px] font-bold text-heading">Create entry</h2>
          <div>
            <label htmlFor="wl-ref" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Entity reference (internal key/hash/ref)</label>
            <input id="wl-ref" value={newRef} onChange={(e) => setNewRef(e.target.value)} className="w-full w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" placeholder="e.g. company:example or hashed ref" />
          </div>
          <div>
            <label htmlFor="wl-reason" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Reason</label>
            <textarea id="wl-reason" value={newReason} onChange={(e) => setNewReason(e.target.value)} className="w-full w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" rows={2} />
          </div>
          <div>
            <label htmlFor="wl-evidence" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Evidence reference</label>
            <input id="wl-evidence" value={newEvidence} onChange={(e) => setNewEvidence(e.target.value)} className="w-full w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" />
          </div>
          <button type="button" onClick={createEntry} disabled={creating || !newRef.trim()} className="border border-heading bg-action px-4 py-2 font-semibold text-buttonText transition-colors hover:bg-accent2 disabled:opacity-50">
            {creating ? 'Creating…' : 'Create entry'}
          </button>

          <div className="border-t border-border pt-4">
            <h2 className="mb-2 font-display text-[17px] font-bold text-heading">Entries</h2>
            {loading ? <Skeleton className="h-40 w-full" /> : error ? <ErrorState message={error} /> : items.length === 0 ? <p className="text-sm text-muted">No entries.</p> : (
              <ul className="divide-y divide-border">
                {items.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setSelectedId(e.id)} className={`w-full p-3 text-left transition-colors ${selectedId === e.id ? 'bg-tint/70 shadow-[inset_3px_0_0_0_var(--color-stamp)]' : 'border-border'}`}>
                      <div className="font-mono text-xs text-muted">{e.entity_reference}</div>
                      <div className="mt-1 text-sm"><strong>Status:</strong> {e.status}</div>
                      {e.reason && <div className="mt-1 text-xs text-muted line-clamp-2">{e.reason}</div>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="border border-border p-4 space-y-4">
          <h2 className="font-display text-[17px] font-bold text-heading">Entry detail & transitions</h2>
          {!selected ? (
            <p className="text-sm text-muted">Select an entry.</p>
          ) : (
            <>
              <div className="bg-tint/40 p-3 text-sm space-y-1">
                <div><strong>ID:</strong> <span className="font-mono text-xs">{selected.id}</span></div>
                <div><strong>Entity:</strong> <span className="font-mono text-xs">{selected.entity_reference}</span></div>
                <div><strong>Status:</strong> {selected.status}</div>
                <div><strong>Reason:</strong> {selected.reason || '—'}</div>
                <div><strong>Evidence ref:</strong> {selected.evidence_reference || '—'}</div>
                <div><strong>Source:</strong> {selected.source || '—'}</div>
                <div><strong>Confidence:</strong> {selected.confidence ?? '—'}</div>
                <div><strong>Reviewed at:</strong> {selected.reviewed_at || '—'}</div>
              </div>

              <div className="border border-border p-3 space-y-3">
                <h3 className="font-medium text-heading">Status transition (audited)</h3>
                {allowed.length === 0 ? (
                  <p className="text-sm text-muted">No transitions available from current status.</p>
                ) : (
                  <>
                    <div>
                      <label htmlFor="wl-target-status" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Target status</label>
                      <select id="wl-target-status" value={actionStatus} onChange={(e) => setActionStatus(e.target.value)} className="w-full w-full border border-border bg-surface px-3 py-2 text-[15px] text-text">
                        {allowed.map((s) => <option key={s} value={s}>{s}{s === 'confirmed_pattern' ? ' (requires moderator approval)' : ''}</option>)}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="wl-action-reason" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Reason (required)</label>
                      <textarea id="wl-action-reason" value={actionReason} onChange={(e) => setActionReason(e.target.value)} className="w-full w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" rows={3} />
                    </div>
                    {actionStatus === 'confirmed_pattern' && (
                      <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={confirmElevated} onChange={(e) => setConfirmElevated(e.target.checked)} />
                        I confirm this elevated status is evidence-backed and approved for review.
                      </label>
                    )}
                    {actionError && <div role="alert" className="border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div>}
                    <button type="button" onClick={applyTransition} disabled={saving || !actionStatus} className="border border-heading bg-action px-4 py-2 font-semibold text-buttonText transition-colors hover:bg-accent2 disabled:opacity-50">
                      {saving ? 'Applying…' : 'Apply transition'}
                    </button>
                    <p className="text-xs text-muted">Actions are recorded in the audit log on the server.</p>
                  </>
                )}
              </div>

              <div className="border border-border p-3 space-y-2">
                <h3 className="font-medium text-heading">Appeals queue</h3>
                <p className="text-sm text-muted">A dedicated appeals listing endpoint is not available in this backend build. Appeals submitted via API reopen entries to <code>under_review</code> and are auditable.</p>
              </div>

              <div className="border border-border p-3 space-y-2">
                <h3 className="font-medium text-heading">Neutral-language public preview</h3>
                <pre className="overflow-auto border border-border bg-tint/40 p-2 text-xs whitespace-pre-wrap">{publicPreview || '—'}</pre>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

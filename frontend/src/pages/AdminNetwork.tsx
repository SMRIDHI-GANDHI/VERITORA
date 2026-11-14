import { useEffect, useMemo, useState } from 'react'
import { getAdminNetworkAlerts, type NetworkAlert } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'

const GRAPH_CAP = 40

function alertEntities(a: NetworkAlert): string[] {
  const ids = (a.entities || [])
    .map((e) => e.id || e.entity_ref_hash || 'unknown')
    .filter(Boolean) as string[]
  return ids.length ? ids : ['unknown']
}

export function AdminNetwork() {
  const [items, setItems] = useState<NetworkAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'graph' | 'table'>('graph')
  const [selected, setSelected] = useState<NetworkAlert | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getAdminNetworkAlerts()
      .then((r) => {
        if (!mounted) return
        setItems(r.items || [])
      })
      .catch(() => {
        if (!mounted) return
        setError('Unable to load network alerts.')
      })
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [])

  const visible = useMemo(() => (showAll ? items : items.slice(0, GRAPH_CAP)), [items, showAll])

  const graphModel = useMemo(() => {
    const nodes = new Map<string, { id: string; label: string }>()
    const edges: Array<{ id: string; source: string; target: string; type: string; similarity?: number | null }> = []
    visible.forEach((a, idx) => {
      const ents = alertEntities(a)
      ents.forEach((e) => {
        if (!nodes.has(e)) nodes.set(e, { id: e, label: e.slice(0, 8) })
      })
      if (ents.length >= 2) {
        edges.push({
          id: a.relationship_id || `edge-${idx}`,
          source: ents[0],
          target: ents[1],
          type: a.relationship_type,
          similarity: a.evidence?.similarity ?? null,
        })
      } else if (ents.length === 1) {
        edges.push({
          id: a.relationship_id || `edge-${idx}`,
          source: ents[0],
          target: ents[0],
          type: a.relationship_type,
          similarity: a.evidence?.similarity ?? null,
        })
      }
    })
    const nodeArr = Array.from(nodes.values())
    // simple circular layout
    const w = 700
    const h = 360
    const cx = w / 2
    const cy = h / 2
    const r = Math.max(80, Math.min(140, 40 + nodeArr.length * 6))
    const pos = new Map<string, { x: number; y: number }>()
    nodeArr.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, nodeArr.length)
      pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) })
    })
    return { nodes: nodeArr, edges, pos, w, h }
  }, [visible])

  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-heading">Network alerts (moderator)</h1>
        <p className="mt-2 text-muted">Review related patterns and leads. Identifiers are hashed/masked.</p>
      </div>

      <div role="note" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-heading">
        <strong>Lead for review, not proof of wrongdoing.</strong> Network links are signals for investigation and moderation review only.
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setView('graph')} className={`rounded-lg border px-3 py-2 text-sm ${view === 'graph' ? 'border-caramel bg-caramel/20' : 'border-border bg-surface'}`}>Graph view</button>
        <button type="button" onClick={() => setView('table')} className={`rounded-lg border px-3 py-2 text-sm ${view === 'table' ? 'border-caramel bg-caramel/20' : 'border-border bg-surface'}`}>Table view (accessible)</button>
        {items.length > GRAPH_CAP && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            {showAll ? 'Show capped view' : `Show more (${items.length - GRAPH_CAP} more)`}
          </button>
        )}
        <span className="text-xs text-muted">Showing {visible.length} of {items.length} alerts {reducedMotion ? '(reduced motion)' : ''}</span>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-24 w-full" /></div>
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">No network alerts available.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-xl border border-border bg-surface p-4">
            {view === 'graph' ? (
              <div>
                <h2 className="mb-2 text-lg font-semibold text-heading">Relationship graph</h2>
                <p className="mb-3 text-xs text-muted">Interactive selection: click nodes/edges in table or select an alert to view details. Canvas is decorative; use table view for full accessible parity.</p>
                <svg
                  role="img"
                  aria-label={`Network graph summary with ${graphModel.nodes.length} nodes and ${graphModel.edges.length} relationships`}
                  viewBox={`0 0 ${graphModel.w} ${graphModel.h}`}
                  className="w-full rounded-lg border border-border bg-surface2/20"
                >
                  {graphModel.edges.map((e) => {
                    const a = graphModel.pos.get(e.source)
                    const b = graphModel.pos.get(e.target)
                    if (!a || !b) return null
                    const active = selected?.relationship_id === e.id
                    return (
                      <line
                        key={e.id}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={active ? 'rgb(var(--color-caramel))' : 'rgb(var(--color-border))'}
                        strokeWidth={active ? 3 : 2}
                        opacity={0.9}
                      />
                    )
                  })}
                  {graphModel.nodes.map((n) => {
                    const p = graphModel.pos.get(n.id)
                    if (!p) return null
                    return (
                      <g key={n.id}>
                        <circle cx={p.x} cy={p.y} r={16} fill="rgb(var(--color-accent))" opacity={0.85} />
                        <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="10" fill="rgb(var(--color-button-text))">
                          {n.label}
                        </text>
                      </g>
                    )
                  })}
                </svg>
                <div className="mt-3 text-xs text-muted">
                  Text summary: {graphModel.nodes.length} entities, {graphModel.edges.length} relationships. Types: {Array.from(new Set(visible.map((v) => v.relationship_type))).join(', ') || 'n/a'}.
                </div>
              </div>
            ) : (
              <div>
                <h2 className="mb-2 text-lg font-semibold text-heading">Relationships table</h2>
                <div className="overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th className="p-2">Type</th>
                        <th className="p-2">Kind</th>
                        <th className="p-2">Similarity</th>
                        <th className="p-2">Confidence</th>
                        <th className="p-2">Review</th>
                        <th className="p-2">Entities</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((a, i) => (
                        <tr key={a.relationship_id || i} className={`cursor-pointer border-b border-border ${selected === a ? 'bg-caramel/10' : ''}`} onClick={() => setSelected(a)}>
                          <td className="p-2">{a.relationship_type}</td>
                          <td className="p-2">{a.evidence?.kind || '—'}</td>
                          <td className="p-2">{a.evidence?.similarity ?? '—'}</td>
                          <td className="p-2">{a.confidence ?? '—'}</td>
                          <td className="p-2">{a.review_status || '—'}</td>
                          <td className="p-2 font-mono text-xs">{alertEntities(a).map((e) => e.slice(0, 10)).join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <aside className="rounded-xl border border-border bg-surface p-4">
            <h2 className="text-lg font-semibold text-heading">Alert details</h2>
            {!selected ? (
              <p className="mt-2 text-sm text-muted">Select an alert (table row) to view details.</p>
            ) : (
              <div className="mt-3 space-y-3 text-sm">
                <div><strong>Relationship:</strong> {selected.relationship_type}</div>
                <div><strong>Relationship ID:</strong> <span className="font-mono text-xs">{selected.relationship_id || '—'}</span></div>
                <div><strong>Review status:</strong> {selected.review_status || '—'}</div>
                <div><strong>Confidence:</strong> {selected.confidence ?? '—'}</div>
                <div><strong>Similarity:</strong> {selected.evidence?.similarity ?? '—'}</div>
                <div><strong>Evidence kind:</strong> {selected.evidence?.kind || '—'}</div>
                <div>
                  <strong>Shared attributes (hashed/masked only):</strong>
                  <ul className="mt-1 list-disc space-y-1 pl-5 font-mono text-xs text-muted">
                    {alertEntities(selected).map((e) => <li key={e}>{e}</li>)}
                  </ul>
                </div>
                <div>
                  <strong>Record refs / timestamps:</strong>
                  <pre className="mt-1 overflow-auto rounded border border-border bg-surface2/30 p-2 text-xs">{JSON.stringify(selected.evidence?.record_refs || {}, null, 2)}</pre>
                </div>
                <div>
                  <strong>Detail:</strong>
                  <pre className="mt-1 overflow-auto rounded border border-border bg-surface2/30 p-2 text-xs">{JSON.stringify(selected.evidence?.detail || {}, null, 2)}</pre>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

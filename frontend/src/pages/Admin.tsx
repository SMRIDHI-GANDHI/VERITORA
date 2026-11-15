import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  adminListAppeals,
  adminListAuditLogs,
  adminListReports,
  adminModerateReport,
  HttpError,
  type AdminAppeal,
  type AdminAuditLogItem,
  type AdminReport,
  type ModerationActionType,
} from '../lib/api'
import { StatusLabel } from '../components/ui/StatusLabel'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { Masthead } from '../components/ui/Masthead'
import { Stamp } from '../components/ui/Stamp'
import { useAuth } from '../auth/useAuth'

const transitions: Record<string, Set<string>> = {
  pending_review: new Set(['under_review', 'evidence_requested', 'substantiated', 'inconclusive', 'rejected', 'removed', 'redact']),
  under_review: new Set(['evidence_requested', 'substantiated', 'inconclusive', 'rejected', 'removed', 'redact']),
  evidence_requested: new Set(['under_review', 'substantiated', 'inconclusive', 'rejected', 'removed', 'redact']),
  substantiated: new Set(['removed', 'redact', 'inconclusive']),
  inconclusive: new Set(['removed', 'redact', 'substantiated']),
  rejected: new Set(['removed', 'redact']),
  removed: new Set(),
}

const actionToTarget: Record<ModerationActionType, string> = {
  approve: 'substantiated',
  reject: 'rejected',
  mark_inconclusive: 'inconclusive',
  request_evidence: 'evidence_requested',
  remove: 'removed',
  redact: 'under_review',
}

function canDo(status: string, action: ModerationActionType) {
  const target = actionToTarget[action]
  if (action === 'redact') return transitions[status]?.has('redact') ?? false
  if (action === 'mark_inconclusive' && status === 'inconclusive') return false
  return transitions[status]?.has(target) ?? false
}

export function Admin() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [tab, setTab] = useState<'reports' | 'ratings' | 'appeals' | 'audit'>('reports')
  const [statusFilter, setStatusFilter] = useState('')
  const [items, setItems] = useState<AdminReport[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [action, setAction] = useState<ModerationActionType>('approve')
  const [reason, setReason] = useState('')
  const [publicSummary, setPublicSummary] = useState('')
  const [privateNote, setPrivateNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const [appeals, setAppeals] = useState<AdminAppeal[]>([])
  const [appealsLoading, setAppealsLoading] = useState(false)
  const [appealsError, setAppealsError] = useState<string | null>(null)
  const [appealSelectedId, setAppealSelectedId] = useState<string | null>(null)

  const [auditItems, setAuditItems] = useState<AdminAuditLogItem[]>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditError, setAuditError] = useState<string | null>(null)
  const [auditActionFilter, setAuditActionFilter] = useState('')
  const [auditResourceFilter, setAuditResourceFilter] = useState('')
  const [auditCursor, setAuditCursor] = useState<string | null>(null)
  const [auditNextCursor, setAuditNextCursor] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await adminListReports(statusFilter || undefined)
      setItems(res.items || [])
    } catch {
      setError(t('admin.reports.loadError', { defaultValue: 'Unable to load moderation queue. You may not have permission or the service is unavailable.' }))
    } finally {
      setLoading(false)
    }
  }

  async function loadAppeals() {
    setAppealsLoading(true)
    setAppealsError(null)
    try {
      const res = await adminListAppeals()
      setAppeals(res.items || [])
    } catch {
      setAppealsError(t('admin.appeals.loadError', { defaultValue: 'Unable to load appeals queue.' }))
    } finally {
      setAppealsLoading(false)
    }
  }

  async function loadAudit(cursor: string | null = null) {
    if (user?.role !== 'admin') return
    setAuditLoading(true)
    setAuditError(null)
    try {
      const res = await adminListAuditLogs({
        limit: 50,
        cursor,
        action: auditActionFilter.trim() || undefined,
        resource_type: auditResourceFilter.trim() || undefined,
      })
      setAuditItems(res.items || [])
      setAuditCursor(cursor)
      setAuditNextCursor(res.next_cursor ?? null)
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        setAuditError(t('admin.audit.forbidden', { defaultValue: 'Audit log access is restricted to administrators.' }))
      } else {
        setAuditError(t('admin.audit.loadError', { defaultValue: 'Unable to load audit logs.' }))
      }
    } finally {
      setAuditLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'reports') void load()
    if (tab === 'appeals') void loadAppeals()
    if (tab === 'audit') void loadAudit(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, statusFilter])

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId])
  const selectedAppeal = useMemo(() => appeals.find((a) => a.id === appealSelectedId) || null, [appeals, appealSelectedId])

  function openAppealReport(appeal: AdminAppeal) {
    const r = appeal.report
    if (!r) return
    setItems((prev) => (prev.some((i) => i.id === r.id) ? prev.map((i) => (i.id === r.id ? { ...i, ...r } : i)) : [r, ...prev]))
    setSelectedId(r.id)
    setTab('reports')
  }

  async function submitAction() {
    if (!selected) return
    setActionError(null)
    if (reason.trim().length < 3) {
      setActionError('A reason is required (minimum 3 characters).')
      return
    }
    if (action === 'remove' && !confirmRemove) {
      setActionError('Please confirm the removal action.')
      return
    }
    setSaving(true)
    try {
      const updated = await adminModerateReport(selected.id, {
        action,
        reason: reason.trim(),
        public_summary: publicSummary.trim() || undefined,
        private_note: privateNote.trim() || undefined,
      })
      setItems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)))
      setReason('')
      setPrivateNote('')
      setConfirmRemove(false)
    } catch (err) {
      if (err instanceof HttpError) setActionError(err.problem?.detail || err.message)
      else setActionError('Moderation action failed.')
    } finally {
      setSaving(false)
    }
  }

  const allowed = selected ? (['approve', 'reject', 'mark_inconclusive', 'request_evidence', 'remove', 'redact'] as ModerationActionType[]).filter((a) => canDo(selected.moderation_status, a)) : []

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead
        title="Admin / Moderation"
        subtitle="Role-gated moderation tools. Actions are auditable; provide clear reasons."
        aside={<Stamp lines={['Role', 'moderator']} tone="ink" />}
      />

      <div className="flex flex-wrap gap-px border-b border-heading">
        {(['reports', 'ratings', 'appeals', 'audit'] as const).map((tname) => (
          <button key={tname} type="button" onClick={() => setTab(tname)} aria-pressed={tab === tname} className={`-mb-px border-b-2 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${tab === tname ? 'border-stamp bg-tint/60 text-heading' : 'border-transparent text-muted hover:text-heading'}`}>
            {tname === 'reports' ? 'Reports queue' : tname === 'ratings' ? 'Rating review' : tname === 'appeals' ? 'Appeals' : 'Audit log'}
          </button>
        ))}
      </div>

      {tab === 'appeals' ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[17px] font-bold text-heading">{t('admin.appeals.queue', { defaultValue: 'Appeals queue' })}</h2>
              <button type="button" onClick={loadAppeals} className="border border-heading px-3 py-1.5 text-sm font-semibold text-heading transition-colors hover:bg-tint/40">{t('common.retry', { defaultValue: 'Refresh' })}</button>
            </div>
            <p className="mb-3 text-sm text-muted">{t('admin.appeals.note', { defaultValue: 'Appeals are submitted by report owners. Review the message and linked report, then take an appropriate moderation action on the report.' })}</p>
            {appealsLoading ? <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : appealsError ? <ErrorState message={appealsError} /> : appeals.length === 0 ? <p className="text-sm text-muted">{t('admin.appeals.empty', { defaultValue: 'No appeals found.' })}</p> : (
              <ul className="divide-y divide-border">
                {appeals.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setAppealSelectedId(a.id)} className={`w-full p-3 text-left transition-colors ${appealSelectedId === a.id ? 'bg-tint/70 shadow-[inset_3px_0_0_0_var(--color-stamp)]' : 'border-border bg-surface'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-heading">{a.report?.company_name || t('admin.appeals.unknownReport', { defaultValue: 'Report' })}</span>
                        {a.report?.moderation_status && <span className="text-xs text-muted">{a.report.moderation_status}</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{a.message || '—'}</p>
                      <p className="mt-1 text-xs text-muted">{a.submitted_at || ''}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-border p-4">
            <h2 className="font-display text-[17px] font-bold text-heading">{t('admin.appeals.detail', { defaultValue: 'Appeal detail' })}</h2>
            {!selectedAppeal ? (
              <p className="mt-2 text-sm text-muted">{t('admin.appeals.select', { defaultValue: 'Select an appeal to review.' })}</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="bg-tint/40 p-3 text-sm">
                  <p><strong>{t('admin.appeals.appealId', { defaultValue: 'Appeal ID' })}:</strong> {selectedAppeal.id}</p>
                  <p><strong>{t('admin.appeals.reportId', { defaultValue: 'Report ID' })}:</strong> {selectedAppeal.report_id}</p>
                  <p><strong>{t('admin.appeals.submittedAt', { defaultValue: 'Submitted' })}:</strong> {selectedAppeal.submitted_at || '—'}</p>
                </div>
                <div>
                  <h3 className="mb-1 font-medium text-heading">{t('admin.appeals.message', { defaultValue: 'Appeal message' })}</h3>
                  <div className="border border-border bg-tint/30 p-2 text-sm whitespace-pre-wrap">{selectedAppeal.message || '—'}</div>
                </div>
                {selectedAppeal.report ? (
                  <div className="space-y-2 border border-border p-3 text-sm">
                    <h3 className="font-medium text-heading">{t('admin.appeals.linkedReport', { defaultValue: 'Linked report' })}</h3>
                    <p><strong>{t('admin.appeals.company', { defaultValue: 'Company' })}:</strong> {selectedAppeal.report.company_name}</p>
                    <p><strong>{t('admin.appeals.status', { defaultValue: 'Status' })}:</strong> {selectedAppeal.report.moderation_status}</p>
                    <p><strong>{t('admin.appeals.category', { defaultValue: 'Category' })}:</strong> {selectedAppeal.report.category}</p>
                    <button type="button" onClick={() => openAppealReport(selectedAppeal)} className="mt-2 border border-heading px-3 py-2 text-sm font-semibold text-heading transition-colors hover:bg-tint/40">
                      {t('admin.appeals.openReport', { defaultValue: 'Open report in moderation queue' })}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t('admin.appeals.missingReport', { defaultValue: 'Linked report details are unavailable.' })}</p>
                )}
              </div>
            )}
          </section>
        </div>
      ) : tab === 'audit' ? (
        <section className="border border-border p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-[17px] font-bold text-heading">{t('admin.audit.title', { defaultValue: 'Audit log review' })}</h2>
              <p className="mt-1 text-sm text-muted">{t('admin.audit.subtitle', { defaultValue: 'Administrator-only review of recorded actions. Sensitive details and IPs are not shown.' })}</p>
            </div>
            {user?.role === 'admin' && (
              <button type="button" onClick={() => void loadAudit(auditCursor)} className="border border-heading px-3 py-1.5 text-sm font-semibold text-heading transition-colors hover:bg-tint/40">{t('common.retry', { defaultValue: 'Refresh' })}</button>
            )}
          </div>

          {user?.role !== 'admin' ? (
            <p className="text-sm text-muted">{t('admin.audit.forbidden', { defaultValue: 'Audit log access is restricted to administrators.' })}</p>
          ) : (
            <>
              <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label htmlFor="audit-action" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('admin.audit.actionFilter', { defaultValue: 'Action' })}</label>
                  <input id="audit-action" value={auditActionFilter} onChange={(e) => setAuditActionFilter(e.target.value)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" placeholder="e.g. moderation.approve" />
                </div>
                <div>
                  <label htmlFor="audit-resource" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{t('admin.audit.resourceFilter', { defaultValue: 'Resource type' })}</label>
                  <input id="audit-resource" value={auditResourceFilter} onChange={(e) => setAuditResourceFilter(e.target.value)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" placeholder="e.g. community_report" />
                </div>
                <div className="flex items-end">
                  <button type="button" onClick={() => void loadAudit(null)} className="w-full border border-heading bg-action px-4 py-2 font-semibold text-buttonText transition-colors hover:bg-accent2 sm:w-auto">{t('admin.audit.applyFilters', { defaultValue: 'Apply' })}</button>
                </div>
              </div>

              {auditLoading ? (
                <div className="space-y-2" aria-busy="true"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : auditError ? (
                <ErrorState message={auditError} onRetry={() => void loadAudit(auditCursor)} />
              ) : auditItems.length === 0 ? (
                <p className="text-sm text-muted">{t('admin.audit.empty', { defaultValue: 'No audit events found for the selected filters.' })}</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-muted">
                          <th scope="col" className="py-2 pr-3 font-medium">{t('admin.audit.timestamp', { defaultValue: 'Timestamp' })}</th>
                          <th scope="col" className="py-2 pr-3 font-medium">{t('admin.audit.action', { defaultValue: 'Action' })}</th>
                          <th scope="col" className="py-2 pr-3 font-medium">{t('admin.audit.resource', { defaultValue: 'Resource' })}</th>
                          <th scope="col" className="py-2 pr-3 font-medium">{t('admin.audit.actor', { defaultValue: 'Actor ID' })}</th>
                          <th scope="col" className="py-2 pr-3 font-medium">{t('admin.audit.requestId', { defaultValue: 'Request ID' })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditItems.map((item) => (
                          <tr key={item.id} className="border-b border-border/60 align-top">
                            <td className="py-2 pr-3 whitespace-nowrap">{item.timestamp || '—'}</td>
                            <td className="py-2 pr-3 font-mono text-xs">{item.action || '—'}</td>
                            <td className="py-2 pr-3">
                              <div className="font-mono text-xs">{item.resource_type || '—'}</div>
                              <div className="text-xs text-muted break-all">{item.resource_id || '—'}</div>
                            </td>
                            <td className="py-2 pr-3 font-mono text-xs break-all">{item.actor_id || '—'}</td>
                            <td className="py-2 pr-3 font-mono text-xs break-all">{item.request_id || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => void loadAudit(null)} disabled={auditCursor === null || auditLoading} className="border border-heading px-3 py-1.5 text-sm font-semibold text-heading transition-colors hover:bg-tint/40 disabled:opacity-50">{t('admin.audit.firstPage', { defaultValue: 'First page' })}</button>
                    <button type="button" onClick={() => void loadAudit(auditNextCursor)} disabled={!auditNextCursor || auditLoading} className="border border-heading px-3 py-1.5 text-sm font-semibold text-heading transition-colors hover:bg-tint/40 disabled:opacity-50">{t('admin.audit.nextPage', { defaultValue: 'Next page' })}</button>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ) : tab === 'ratings' ? (
        <section className="border border-border p-5">
          <h2 className="font-display text-[17px] font-bold text-heading">{t('admin.ratings.title', { defaultValue: 'Rating review' })}</h2>
          <p className="mt-2 text-sm text-muted">
            {t('admin.ratings.unavailable', { defaultValue: 'Rating review/duplicate-spam clustering endpoints are not available in this build.' })}
          </p>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <section className="border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-[17px] font-bold text-heading">Moderation queue</h2>
              <button type="button" onClick={load} className="border border-heading px-3 py-1.5 text-sm font-semibold text-heading transition-colors hover:bg-tint/40">Refresh</button>
            </div>
            <div className="mb-3">
              <label htmlFor="status-filter" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Filter by status</label>
              <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text">
                <option value="">All</option>
                {['pending_review', 'under_review', 'evidence_requested', 'substantiated', 'inconclusive', 'rejected', 'removed'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {loading ? <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : error ? <ErrorState message={error} /> : items.length === 0 ? <p className="text-sm text-muted">No reports found.</p> : (
              <ul className="divide-y divide-border">
                {items.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelectedId(r.id)} className={`w-full p-3 text-left transition-colors ${selectedId === r.id ? 'bg-tint/70 shadow-[inset_3px_0_0_0_var(--color-stamp)]' : 'border-border bg-surface'}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-heading">{r.company_name}</span>
                        <span className="text-xs text-muted">{r.category}</span>
                        <StatusLabel status={r.moderation_status === 'substantiated' ? 'checked' : r.moderation_status === 'inconclusive' ? 'inconclusive' : r.moderation_status === 'rejected' || r.moderation_status === 'removed' ? 'warning' : 'under_review'} />
                        {r.pii_flagged && <span className="border border-danger px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-danger">PII flagged</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted">{r.description}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-border p-4">
            <h2 className="font-display text-[17px] font-bold text-heading">Report detail & actions</h2>
            {!selected ? (
              <p className="mt-2 text-sm text-muted">Select a report to review.</p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="bg-tint/40 p-3 text-sm">
                  <p><strong>ID:</strong> {selected.id}</p>
                  <p><strong>Status:</strong> {selected.moderation_status}</p>
                  <p><strong>Company:</strong> {selected.company_name}</p>
                  <p><strong>Category:</strong> {selected.category}</p>
                  <p><strong>Job:</strong> {selected.job_title || '—'} {selected.job_url ? `(${selected.job_url})` : ''}</p>
                  <p><strong>Recruiter identifier:</strong> {selected.recruiter_identifier || '—'}</p>
                  <p><strong>PII flagged:</strong> {selected.pii_flagged ? 'Yes' : 'No'}</p>
                </div>
                <div>
                  <h3 className="mb-1 font-medium text-heading">Original description (moderator view)</h3>
                  <div className="max-h-48 overflow-auto border border-border bg-tint/30 p-2 text-sm whitespace-pre-wrap">{selected.description}</div>
                </div>
                <div>
                  <h3 className="mb-1 font-medium text-heading">Current public summary</h3>
                  <div className="border border-border bg-tint/30 p-2 text-sm">{selected.public_summary || '—'}</div>
                </div>

                <div className="space-y-3 border border-border p-3">
                  <h3 className="font-medium text-heading">Moderation action</h3>
                  <div>
                    <label htmlFor="action" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Action</label>
                    <select id="action" value={action} onChange={(e) => setAction(e.target.value as ModerationActionType)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text">
                      {(['approve', 'reject', 'mark_inconclusive', 'request_evidence', 'remove', 'redact'] as ModerationActionType[]).map((a) => (
                        <option key={a} value={a} disabled={!canDo(selected.moderation_status, a)}>
                          {a}{!canDo(selected.moderation_status, a) ? ' (invalid transition)' : ''}
                        </option>
                      ))}
                    </select>
                    {allowed.length === 0 && <p className="mt-1 text-xs text-danger">No valid transitions from current status.</p>}
                  </div>
                  <div>
                    <label htmlFor="reason" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Reason (required)</label>
                    <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" rows={3} />
                  </div>
                  <div>
                    <label htmlFor="pubsum" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Public summary (redacted, neutral)</label>
                    <textarea id="pubsum" value={publicSummary} onChange={(e) => setPublicSummary(e.target.value)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" rows={3} placeholder="Required for public visibility; use neutral, redacted wording." />
                  </div>
                  <div>
                    <label htmlFor="pnote" className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Private note (moderators only)</label>
                    <textarea id="pnote" value={privateNote} onChange={(e) => setPrivateNote(e.target.value)} className="w-full border border-border bg-surface px-3 py-2 text-[15px] text-text" rows={2} />
                    <p className="mt-1 text-xs text-muted">Private notes are not shown to non-moderators.</p>
                  </div>
                  {action === 'remove' && (
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={confirmRemove} onChange={(e) => setConfirmRemove(e.target.checked)} />
                      I confirm this removal/destructive moderation action.
                    </label>
                  )}
                  {actionError && <div role="alert" className="border-l-2 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">{actionError}</div>}
                  <button type="button" onClick={submitAction} disabled={saving || !canDo(selected.moderation_status, action)} className="border border-heading bg-action px-4 py-2 font-semibold text-buttonText transition-colors hover:bg-accent2 disabled:opacity-50">
                    {saving ? 'Applying...' : 'Apply action'}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

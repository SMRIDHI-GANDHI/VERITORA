import { useTranslation } from 'react-i18next'

export type StatusKind = 'checked' | 'warning' | 'inconclusive' | 'not_checked' | 'under_review'

const icons: Record<StatusKind, string> = {
  checked: '✓',
  warning: '⚠',
  inconclusive: '?',
  not_checked: '–',
  under_review: '⏳',
}

const styles: Record<StatusKind, string> = {
  checked: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  inconclusive: 'border-accent/40 bg-accent/10 text-accent',
  not_checked: 'border-border bg-surface text-muted',
  under_review: 'border-accent/40 bg-accent/10 text-accent',
}

export function StatusLabel({ status }: { status: StatusKind }) {
  const { t } = useTranslation()
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-medium ${styles[status]}`}>
      <span aria-hidden="true">{icons[status]}</span>
      <span>{t(`status.${status}`)}</span>
    </span>
  )
}
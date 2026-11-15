import { useTranslation } from 'react-i18next'
import { Icon, type IconName } from './Icon'

export type StatusKind = 'checked' | 'warning' | 'inconclusive' | 'not_checked' | 'under_review'

const meta: Record<StatusKind, { icon: IconName; className: string }> = {
  checked: { icon: 'checked', className: 'border-success/50 bg-success/10 text-success' },
  warning: { icon: 'warning', className: 'border-warning/50 bg-warning/10 text-warning' },
  inconclusive: { icon: 'inconclusive', className: 'border-accent/40 bg-accent/10 text-accent' },
  not_checked: { icon: 'not-checked', className: 'border-border bg-surface2/50 text-muted' },
  under_review: { icon: 'under-review', className: 'border-accent/40 bg-accent/10 text-accent' },
}

/**
 * A status is always icon + word, never colour alone, and it is set like a
 * stamped field entry rather than a pill: the product's vocabulary is fixed to
 * these five words and no verdict may stand in for them.
 */
export function StatusLabel({ status }: { status: StatusKind }) {
  const { t } = useTranslation()
  const m = meta[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.1em] ${m.className}`}
    >
      <Icon name={m.icon} size={13} />
      <span>{t(`status.${status}`)}</span>
    </span>
  )
}

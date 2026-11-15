import { Icon, type IconName } from './Icon'

type Band = 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'

const labels: Record<Band, string> = {
  lower: 'Lower concern',
  moderate: 'Moderate concern',
  high_concern: 'High concern',
  very_high_concern: 'Very high concern',
  insufficient_information: 'Insufficient information',
}

const meta: Record<Band, { icon: IconName; className: string }> = {
  lower: { icon: 'checked', className: 'border-success/60 bg-success/10 text-success' },
  moderate: { icon: 'warning', className: 'border-warning/60 bg-warning/10 text-warning' },
  high_concern: { icon: 'warning', className: 'border-stamp/60 bg-stamp/10 text-stamp' },
  very_high_concern: { icon: 'warning', className: 'border-stamp bg-stamp/15 text-stamp' },
  insufficient_information: { icon: 'inconclusive', className: 'border-ash/50 bg-ash/10 text-ash' },
}

/** The band is always a sentence of words; colour and icon only corroborate it. */
export function RiskBand({ band, size = 'md' }: { band: Band; size?: 'sm' | 'md' }) {
  const m = meta[band]
  const sizing = size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-sm'
  return (
    <span
      className={`inline-flex items-center gap-1.5 border font-semibold leading-none ${sizing} ${m.className}`}
    >
      <Icon name={m.icon} size={size === 'sm' ? 12 : 14} />
      {labels[band]}
    </span>
  )
}

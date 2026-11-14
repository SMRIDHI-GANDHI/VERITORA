type Band = 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'

const labels: Record<Band, string> = {
  lower: 'Lower concern',
  moderate: 'Moderate concern',
  high_concern: 'High concern',
  very_high_concern: 'Very high concern',
  insufficient_information: 'Insufficient information',
}

const styles: Record<Band, string> = {
  lower: 'border-success/40 bg-success/10 text-success',
  moderate: 'border-warning/40 bg-warning/10 text-warning',
  high_concern: 'border-danger/50 bg-danger/10 text-danger',
  very_high_concern: 'border-danger/60 bg-danger/15 text-danger',
  insufficient_information: 'border-mocha/30 bg-mocha/10 text-mocha',
}

export function RiskBand({ band }: { band: Band }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${styles[band]}`}>
      {labels[band]}
    </span>
  )
}
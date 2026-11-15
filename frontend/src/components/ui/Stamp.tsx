import type { ReactNode } from 'react'

export type StampTone = 'stamp' | 'warning' | 'ink' | 'muted'

const tones: Record<StampTone, string> = {
  stamp: 'border-stamp text-stamp bg-stamp/10',
  warning: 'border-warning text-warning bg-warning/10',
  ink: 'border-heading text-heading bg-transparent',
  muted: 'border-border text-muted bg-transparent',
}

type Props = {
  /** One line per row; the block is typeset like a dated office stamp. */
  lines: ReactNode[]
  tone?: StampTone
  /** Presses the impression onto the row as it enters view. */
  animate?: boolean
  delayMs?: number
  className?: string
}

/**
 * The signature of the world: a dated stamp carrying status, date and source.
 * It is the one place vermillion is allowed to speak, and it never carries a
 * claim on its own — the row beside it always says the same thing in words.
 */
export function Stamp({ lines, tone = 'stamp', animate = false, delayMs = 0, className = '' }: Props) {
  return (
    <span
      className={`inline-flex flex-col items-center border-2 px-2.5 py-1.5 text-center font-mono text-[10px] font-bold uppercase leading-[1.7] tracking-[0.1em] ${tones[tone]} ${
        animate ? 'stamp-press' : ''
      } ${className}`.trim()}
      style={animate ? { animationDelay: `${delayMs}ms` } : undefined}
    >
      {lines.map((line, i) => (
        <span key={i} className="block whitespace-nowrap">
          {line}
        </span>
      ))}
    </span>
  )
}

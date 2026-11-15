import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  subtitle?: ReactNode
  /** Right-hand slot: case reference, primary action, filters. */
  aside?: ReactNode
  className?: string
}

/**
 * The masthead of a file: title on the left, the record's reference and its
 * primary action on the right, closed by a double rule. Every page wears one so
 * the whole product reads as one document set rather than a folder of screens.
 */
export function Masthead({ title, subtitle, aside, className = '' }: Props) {
  return (
    <header className={`mb-7 ${className}`.trim()}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3">
        <div className="min-w-0">
          <h1 className="font-display text-[1.75rem] leading-[1.2] tracking-[-0.01em] text-heading sm:text-[2rem]">
            {title}
          </h1>
          {subtitle && <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {aside && <div className="flex flex-wrap items-center gap-2.5">{aside}</div>}
      </div>
      <div className="rule-double" aria-hidden="true" />
    </header>
  )
}

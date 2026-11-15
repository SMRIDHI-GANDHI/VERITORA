import type { ReactNode } from 'react'

type Props = {
  title: ReactNode
  /** Small mono note on the rule: a count, a reference, a state. */
  meta?: ReactNode
  /** Right-hand control: a filter, a link, a disclosure. */
  action?: ReactNode
  children: ReactNode
  className?: string
  /** Anchor target (e.g. "All recommendations" jumps here). */
  id?: string
  /** Give the section heading an id when something must label it. */
  headingId?: string
}

/** A headed passage of the file: serif heading, hairline rule, then the entries. */
export function Section({ title, meta, action, children, className = '', id, headingId }: Props) {
  return (
    <section id={id} className={className}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-1.5 border-b border-border pb-2">
        <h2 id={headingId} className="font-display text-[17px] font-bold leading-snug text-heading">{title}</h2>
        {(meta || action) && (
          <div className="flex items-baseline gap-4">
            {meta && <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{meta}</span>}
            {action}
          </div>
        )}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  )
}

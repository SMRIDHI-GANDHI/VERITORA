import type { ReactNode } from 'react'

type Span = { start: number; end: number }

export function HighlightedText({
  text,
  spans,
}: {
  text: string
  spans: Span[]
}) {
  const valid = spans
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && s.end <= text.length)
    .sort((a, b) => a.start - b.start)

  if (valid.length === 0) {
    return <pre className="whitespace-pre-wrap break-words text-sm text-text">{text}</pre>
  }

  // merge overlaps
  const merged: Span[] = []
  for (const s of valid) {
    const last = merged[merged.length - 1]
    if (!last || s.start > last.end) merged.push({ ...s })
    else last.end = Math.max(last.end, s.end)
  }

  const nodes: ReactNode[] = []
  let cursor = 0
  merged.forEach((s, idx) => {
    if (s.start > cursor) {
      nodes.push(<span key={`t-${idx}-${cursor}`}>{text.slice(cursor, s.start)}</span>)
    }
    nodes.push(
      <mark
        key={`m-${idx}-${s.start}`}
        className="rounded bg-warning/30 px-0.5 text-heading"
        data-span-start={s.start}
        data-span-end={s.end}
      >
        {text.slice(s.start, s.end)}
      </mark>,
    )
    cursor = s.end
  })
  if (cursor < text.length) {
    nodes.push(<span key={`t-end-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return <pre className="whitespace-pre-wrap break-words text-sm text-text">{nodes}</pre>
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-tint/60 ${className}`.trim()} aria-hidden="true" />
}

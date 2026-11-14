import type { AnchorHTMLAttributes, ReactNode } from 'react'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }

export function ExternalLink({ children, className = '', ...props }: Props) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={`text-accent underline underline-offset-2 hover:opacity-90 ${className}`.trim()}
      {...props}
    >
      {children}
    </a>
  )
}
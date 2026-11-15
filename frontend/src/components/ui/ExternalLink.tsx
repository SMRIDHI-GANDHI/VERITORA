import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { Icon } from './Icon'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }

export function ExternalLink({ children, className = '', ...props }: Props) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-accent underline decoration-tint underline-offset-4 transition hover:decoration-accent ${className}`.trim()}
      {...props}
    >
      {children}
      <Icon name="external" size={13} />
    </a>
  )
}

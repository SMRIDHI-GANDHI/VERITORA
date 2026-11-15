import type { ReactElement, SVGProps } from 'react'

/**
 * VERITORA icon set.
 *
 * Drawn here rather than borrowed so every mark shares one stroke weight and
 * one chiselled cap language that belongs to the "Dated Stamp" world. Icons are
 * always decorative: every status ships icon *and* text, never colour alone.
 */

export type IconName =
  | 'checked'
  | 'warning'
  | 'inconclusive'
  | 'not-checked'
  | 'under-review'
  | 'stamp'
  | 'chevron'
  | 'arrow'
  | 'external'
  | 'close'
  | 'info'
  | 'plus'
  | 'file'
  | 'search'
  | 'menu'
  | 'clock'
  | 'bookmark'

const paths: Record<IconName, ReactElement> = {
  checked: <path d="M4 12.6 9.4 18 20 6" />,
  warning: (
    <>
      <path d="M12 3.2 21.5 20H2.5z" />
      <path d="M12 9.6v4.2" />
      <path d="M12 16.6v.6" />
    </>
  ),
  inconclusive: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M9.6 9.6a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6" />
      <path d="M12 16.4v.6" />
    </>
  ),
  'not-checked': (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M6.2 17.8 17.8 6.2" />
    </>
  ),
  'under-review': (
    <>
      <path d="M2.2 12S6 6.4 12 6.4 21.8 12 21.8 12 18 17.6 12 17.6 2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  stamp: (
    <>
      <path d="M4.5 20.5h15" />
      <path d="M6.8 17.6h10.4v-2.2H6.8z" />
      <path d="M9 15.4V11c0-1.6-1.2-2.2-1.2-4.2A4.2 4.2 0 0 1 12 3a4.2 4.2 0 0 1 4.2 3.8c0 2-1.2 2.6-1.2 4.2v4.4" />
    </>
  ),
  chevron: <path d="M9 5.5 15.5 12 9 18.5" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  external: (
    <>
      <path d="M13.6 4H20v6.4" />
      <path d="M20 4 11 13" />
      <path d="M17.6 14.4V20H4V6.4h5.6" />
    </>
  ),
  close: <path d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11v5.4" />
      <path d="M12 7.6v.6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="M15.6 15.6 20.5 20.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 6.8V12l3.6 2.4" />
    </>
  ),
  bookmark: <path d="M6.5 3.5h11v17L12 16.4 6.5 20.5z" />,
}

type Props = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: number
}

export function Icon({ name, size = 16, className = '', ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`.trim()}
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}

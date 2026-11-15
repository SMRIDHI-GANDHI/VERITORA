export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variants: Record<ButtonVariant, string> = {
  primary: 'border-action bg-action text-buttonText hover:bg-accent2 hover:border-accent2',
  secondary: 'border-heading bg-transparent text-heading hover:bg-tint/40',
  ghost: 'border-transparent bg-transparent px-1 text-accent underline underline-offset-4 hover:text-accent2',
  danger: 'border-danger bg-danger/10 text-danger hover:bg-danger/15',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[13px]',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-[15px]',
}

const base =
  'inline-flex items-center justify-center gap-2 border font-semibold leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60'

/**
 * Class string for a button *or* a link that must look like a button. Kept out
 * of the component file so links (`<Link className={buttonClass('secondary')}>`)
 * and `<button>` share one implementation without breaking fast refresh.
 */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()
}

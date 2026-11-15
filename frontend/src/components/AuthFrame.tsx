import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Opening the file cover: the brand face on the ink-blue board, the form on the
 * paper inside. Shared by sign in and sign up so both read as one document set.
 */
export function AuthFrame({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-[1060px] border-2 border-heading bg-surface shadow-paper lg:grid lg:grid-cols-[1fr_500px]">
      <div className="flex flex-col justify-between gap-10 bg-cover px-9 py-10 text-paper max-lg:border-b-2 max-lg:border-heading">
        <span className="text-[26px] font-bold leading-none tracking-[0.18em]">VERITORA</span>
        <div>
          <p className="font-display text-[27px] leading-[1.35]">{t('auth.tagline')}</p>
          <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-paper/85">{t('landing.hero.body')}</p>
        </div>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-paper/70">{t('rail.file')}</p>
      </div>
      <div className="px-8 py-9">{children}</div>
    </div>
  )
}

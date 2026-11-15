import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'

export function EmptyState({ message, action }: { message?: string; action?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="border border-dashed border-tint bg-surface/60 px-5 py-8 text-center">
      <Icon name="file" size={22} className="mx-auto text-tint" />
      <p className="mx-auto mt-3 max-w-[52ch] text-sm leading-relaxed text-muted">{message ?? t('common.empty')}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

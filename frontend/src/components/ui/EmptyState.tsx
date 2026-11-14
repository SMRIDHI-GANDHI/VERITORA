import { useTranslation } from 'react-i18next'

export function EmptyState({ message }: { message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted">
      <p>{message ?? t('common.empty')}</p>
    </div>
  )
}
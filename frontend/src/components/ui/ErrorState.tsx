import { useTranslation } from 'react-i18next'

export function ErrorState({ message, requestId, onRetry }: { message?: string; requestId?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 p-4">
      <p className="font-medium text-danger">{message ?? t('common.error')}</p>
      {requestId && <p className="mt-1 text-xs text-muted">Request ID: {requestId}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded bg-caramel px-3 py-1.5 text-sm font-medium text-buttonText">
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}
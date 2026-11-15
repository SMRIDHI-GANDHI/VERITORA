import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import { buttonClass } from './buttonStyles'

export function ErrorState({ message, requestId, onRetry }: { message?: string; requestId?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="border-2 border-danger bg-danger/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <Icon name="warning" size={18} className="mt-0.5 text-danger" />
        <div className="min-w-0">
          <p className="font-semibold leading-snug text-danger">{message ?? t('common.error')}</p>
          {requestId && (
            <p className="mt-1 font-mono text-[12px] tracking-wide text-muted">Request ID: {requestId}</p>
          )}
          {onRetry && (
            <button type="button" onClick={onRetry} className={buttonClass('secondary', 'sm', 'mt-3')}>
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

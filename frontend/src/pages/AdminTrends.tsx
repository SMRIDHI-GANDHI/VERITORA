import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAdminTrends, HttpError, type TrendResponse } from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Skeleton } from '../components/ui/Skeleton'
import { Stamp } from '../components/ui/Stamp'

const WINDOWS = [4, 8, 12] as const

function formatWeek(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function AdminTrends() {
  const { t } = useTranslation()
  const [weeks, setWeeks] = useState<number>(8)
  const [data, setData] = useState<TrendResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getAdminTrends(weeks)
      .then((res) => {
        if (!active) return
        setData(res)
      })
      .catch((err: unknown) => {
        if (!active) return
        const forbidden = err instanceof HttpError && (err.status === 403 || err.status === 401)
        setError({
          message: forbidden ? t('admin.trends.forbidden') : t('admin.trends.loadError'),
          forbidden,
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [weeks, t, attempt])

  const maxWeekly = useMemo(
    () => Math.max(1, ...(data?.weekly ?? []).map((p) => p.count)),
    [data],
  )

  const categories = useMemo(
    () => Object.entries(data?.total_by_category ?? {}).sort((a, b) => b[1] - a[1]),
    [data],
  )

  const selectId = 'trend-window'

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Masthead
        title={t('admin.trends.title')}
        subtitle={t('admin.trends.subtitle')}
        aside={<Stamp lines={['Trends', 'early warning']} tone="ink" />}
      />

      <div className="border border-border p-4">
        <label htmlFor={selectId} className="mb-1.5 block font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          {t('admin.trends.window')}
        </label>
        <select
          id={selectId}
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="w-full w-full border border-border bg-surface px-3 py-2 text-[15px] text-text text-text sm:w-56"
        >
          {WINDOWS.map((w) => (
            <option key={w} value={w}>
              {t('admin.trends.weeks', { count: w })}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">{t('common.loading')}</span>
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <ErrorState
          message={error.message}
          onRetry={error.forbidden ? undefined : () => setAttempt((n) => n + 1)}
        />
      ) : !data || data.approved_report_total === 0 ? (
        <div className="border border-border p-5 text-sm text-muted">
          {t('admin.trends.empty')}
        </div>
      ) : (
        <>
          <section aria-labelledby="trend-summary" className="space-y-3">
            <h2 id="trend-summary" className="font-display text-[17px] font-bold text-heading">
              {t('admin.trends.summary')}
            </h2>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div className="border border-border p-4">
                <dt className="text-sm text-muted">{t('admin.trends.total')}</dt>
                <dd className="mt-1 font-display text-3xl font-bold text-heading">{data.approved_report_total}</dd>
              </div>
              <div className="border border-border p-4">
                <dt className="text-sm text-muted">{t('admin.trends.rising')}</dt>
                <dd className="mt-1 font-display text-3xl font-bold text-heading">{data.rising_categories.length}</dd>
              </div>
              <div className="border border-border p-4">
                <dt className="text-sm text-muted">{t('admin.trends.generatedAt')}</dt>
                <dd className="mt-1 text-sm text-text">
                  {new Date(data.generated_at).toLocaleString(undefined, { timeZone: 'UTC' })}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="trend-weekly" className="border border-border p-4">
            <h2 id="trend-weekly" className="mb-3 font-display text-[17px] font-bold text-heading">
              {t('admin.trends.weekly')}
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <caption className="sr-only">{t('admin.trends.chartLabel')}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-muted">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t('admin.trends.weekStart')}
                    </th>
                    <th scope="col" className="py-2 pr-3 font-medium">
                      {t('admin.trends.count')}
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      <span className="sr-only">{t('admin.trends.chartLabel')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.weekly.map((p) => {
                    const pct = Math.round((p.count / maxWeekly) * 100)
                    return (
                      <tr key={p.week_start} className="border-b border-border/60">
                        <th scope="row" className="py-2 pr-3 text-left font-normal">
                          {formatWeek(p.week_start)}
                        </th>
                        <td className="py-2 pr-3 tabular-nums">{p.count}</td>
                        <td className="w-1/2 py-2">
                          <div aria-hidden="true" className="h-2.5 w-full bg-tint">
                            <div
                              className="h-2.5 bg-cover"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="trend-rising" className="border border-border p-4">
              <h2 id="trend-rising" className="mb-3 font-display text-[17px] font-bold text-heading">
                {t('admin.trends.rising')}
              </h2>
              {data.rising_categories.length === 0 ? (
                <p className="text-sm text-muted">{t('admin.trends.noRising')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th scope="col" className="py-2 pr-3 font-medium">
                          {t('admin.trends.category')}
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          {t('admin.trends.previous')}
                        </th>
                        <th scope="col" className="py-2 pr-3 font-medium">
                          {t('admin.trends.current')}
                        </th>
                        <th scope="col" className="py-2 font-medium">
                          {t('admin.trends.delta')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rising_categories.map((c) => (
                        <tr key={c.category} className="border-b border-border/60">
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            {c.category}
                          </th>
                          <td className="py-2 pr-3 tabular-nums">{c.previous_count}</td>
                          <td className="py-2 pr-3 tabular-nums">{c.current_count}</td>
                          <td className="py-2 tabular-nums">+{c.delta}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-labelledby="trend-categories" className="border border-border p-4">
              <h2 id="trend-categories" className="mb-3 font-display text-[17px] font-bold text-heading">
                {t('admin.trends.byCategory')}
              </h2>
              {categories.length === 0 ? (
                <p className="text-sm text-muted">{t('admin.trends.empty')}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {categories.map(([category, count]) => (
                    <li key={category} className="flex items-center justify-between gap-3 border-b border-border/60 pb-2">
                      <span>{category}</span>
                      <span className="tabular-nums text-heading">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {data.notes.length > 0 && (
            <section aria-labelledby="trend-notes" className="border border-border p-4">
              <h2 id="trend-notes" className="mb-2 font-display text-[17px] font-bold text-heading">
                {t('admin.trends.notes')}
              </h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {data.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}

          <p className="rounded-none border border-border bg-surface2/40 p-3 text-sm text-muted">
            {t('admin.trends.disclaimer')}
          </p>
        </>
      )}
    </div>
  )
}

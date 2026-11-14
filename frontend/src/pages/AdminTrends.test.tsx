import { render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { vi } from 'vitest'
import i18n from '../i18n'
import { AdminTrends } from './AdminTrends'
import { HttpError } from '../lib/api'

const mockGetAdminTrends = vi.fn()

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    getAdminTrends: (weeks: number) => mockGetAdminTrends(weeks),
  }
})

function renderTrends() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AdminTrends />
    </I18nextProvider>,
  )
}

const base = {
  window_weeks: 8,
  week_start: '2026-09-21',
  generated_at: '2026-11-14T00:00:00+00:00',
  approved_report_total: 5,
  weekly: [
    { week_start: '2026-09-21', count: 1 },
    { week_start: '2026-09-28', count: 4 },
  ],
  total_by_category: { payment_request: 4, impersonation_concern: 1 },
  rising_categories: [
    { category: 'payment_request', previous_count: 1, current_count: 4, delta: 3 },
  ],
  notes: ['Counts include moderator-approved reports only.'],
}

describe('AdminTrends', () => {
  beforeEach(() => {
    mockGetAdminTrends.mockReset()
  })

  it('renders weekly counts and rising categories', async () => {
    mockGetAdminTrends.mockResolvedValue(base)
    renderTrends()

    expect(await screen.findByRole('heading', { name: /trends & early warning/i })).toBeInTheDocument()
    await waitFor(() => expect(mockGetAdminTrends).toHaveBeenCalledWith(8))
    expect((await screen.findAllByText('payment_request')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Approved reports').length).toBeGreaterThan(0)
    expect(screen.getByText('+3')).toBeInTheDocument()
    expect(screen.getByText(base.notes[0])).toBeInTheDocument()
  })

  it('shows the empty state when there are no approved reports', async () => {
    mockGetAdminTrends.mockResolvedValue({
      ...base,
      approved_report_total: 0,
      weekly: [],
      total_by_category: {},
      rising_categories: [],
      notes: [],
    })
    renderTrends()
    expect(await screen.findByText(/no approved reports in this window yet/i)).toBeInTheDocument()
  })

  it('shows a permission message for a forbidden response', async () => {
    mockGetAdminTrends.mockRejectedValue(
      new HttpError('Forbidden', 403, { status: 403, detail: 'Forbidden' }),
    )
    renderTrends()
    expect(await screen.findByText(/do not have permission/i)).toBeInTheDocument()
  })
})

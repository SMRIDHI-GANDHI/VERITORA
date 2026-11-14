import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import i18n from '../i18n'
import { Exposure } from './Exposure'

const mockCheckDataExposure = vi.fn()

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, checkDataExposure: (p: unknown) => mockCheckDataExposure(p) }
})

function renderExposure() {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Exposure />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('Exposure', () => {
  beforeEach(() => {
    mockCheckDataExposure.mockReset()
  })

  it('shows a prominent credential warning and no upload control', async () => {
    renderExposure()

    expect(
      screen.getByRole('alert').textContent?.toLowerCase(),
    ).toContain('do not upload documents here')

    // There must be no file input on the exposure page.
    expect(document.querySelector('input[type="file"]')).toBeNull()
  })

  it('renders grouped classifications from the API response', async () => {
    mockCheckDataExposure.mockResolvedValue({
      items: [
        {
          item: 'Aadhaar number',
          category: 'identity',
          categories: ['identity'],
          necessity: { by_stage: 'May be required during verified onboarding.' },
          necessity_by_stage: 'May be required during verified onboarding.',
          why_may_be_unnecessary: 'Identity documents are rarely needed early.',
          safer_alternative: 'Share redacted copies only after verifying legitimacy.',
          safer_alternatives: ['Share redacted copies only after verifying legitimacy.'],
          warning: null,
        },
        {
          item: 'OTP',
          category: 'credentials',
          categories: ['credentials'],
          necessity: { by_stage: 'Not appropriate at any hiring stage.' },
          necessity_by_stage: 'Not appropriate at any hiring stage.',
          why_may_be_unnecessary: 'Never share passwords, OTPs, or PINs.',
          safer_alternative: 'Refuse and verify through official channels.',
          safer_alternatives: ['Refuse and verify through official channels.'],
          warning: 'Never share passwords, OTPs, banking credentials, or CVV with anyone.',
        },
      ],
      has_high_risk: true,
      hard_warning_message:
        'Never share passwords, OTPs, banking credentials, or CVV with anyone.',
      guidance: ['Do not upload unredacted ID or financial documents here.'],
    })

    const user = userEvent.setup()
    renderExposure()

    await user.click(screen.getByLabelText(/Aadhaar number/i))
    await user.click(screen.getByRole('button', { name: /check exposure/i }))

    await waitFor(() => {
      expect(screen.getByText(/government \/ identity id/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/credentials \/ otp/i)).toBeInTheDocument()
    expect(screen.getByText(/high-risk request detected/i)).toBeInTheDocument()
    expect(screen.getByText(/do not upload unredacted id or financial documents/i)).toBeInTheDocument()
  })

  it('surfaces an error state when the request fails', async () => {
    mockCheckDataExposure.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    renderExposure()

    await user.click(screen.getByLabelText(/OTP/i))
    await user.click(screen.getByRole('button', { name: /check exposure/i }))

    await waitFor(() => {
      expect(screen.getByText(/unable to check data exposure/i)).toBeInTheDocument()
    })
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { vi } from 'vitest'
import i18n from '../i18n'
import { AuthContext, type AuthState } from '../auth/auth-context'
import { Landing } from './Landing'

const auth: AuthState = {
  user: null,
  loading: false,
  login: vi.fn(async () => {}),
  register: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  refreshMe: vi.fn(async () => {}),
}

function Probe() {
  const location = useLocation()
  const state = location.state as { prefillDescription?: string; prefillUrl?: string } | null
  return (
    <div>
      <p data-testid="probe-search">{location.search}</p>
      <p data-testid="probe-description">{state?.prefillDescription ?? ''}</p>
      <p data-testid="probe-url">{state?.prefillUrl ?? ''}</p>
    </div>
  )
}

function renderLanding() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/analyze" element={<Probe />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('Landing', () => {
  it('shows the value proposition, quick check, and safety link', () => {
    renderLanding()

    expect(screen.getByRole('heading', { level: 1, name: 'Check before you trust.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Quick check' })).toBeInTheDocument()
    expect(screen.getByLabelText('Paste a job post, recruiter message, or link')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open cybercrime help' })).toHaveAttribute('href', '/help/cybercrime')
    expect(document.body.textContent).not.toMatch(/\bfake\b|\bgenuine\b/i)
  })

  it('requires input before running a quick check', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.click(screen.getByRole('button', { name: 'Check it' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Paste a job post, message, or link to check.')
  })

  it('prefills the job analyzer with pasted text', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.type(
      screen.getByLabelText('Paste a job post, recruiter message, or link'),
      'Urgent hiring! Pay Rs 1500 registration fee within 24 hours.',
    )
    await user.click(screen.getByRole('button', { name: 'Check it' }))

    expect(await screen.findByTestId('probe-search')).toHaveTextContent('?tab=job')
    expect(screen.getByTestId('probe-description')).toHaveTextContent('Pay Rs 1500 registration fee')
    expect(screen.getByTestId('probe-url')).toBeEmptyDOMElement()
  })

  it('prefills the URL scanner when the quick check input is a link', async () => {
    const user = userEvent.setup()
    renderLanding()

    await user.type(
      screen.getByLabelText('Paste a job post, recruiter message, or link'),
      'https://example.com/careers/123',
    )
    await user.click(screen.getByRole('button', { name: 'Check it' }))

    expect(await screen.findByTestId('probe-search')).toHaveTextContent('?tab=url')
    expect(screen.getByTestId('probe-url')).toHaveTextContent('https://example.com/careers/123')
    expect(screen.getByTestId('probe-description')).toBeEmptyDOMElement()
  })
})

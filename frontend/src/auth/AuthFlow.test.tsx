import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider'
import { AuthProvider } from './AuthContext'
import { AppRoutes } from '../App'
import * as api from '../lib/api'
import '../i18n'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    refresh: vi.fn().mockRejectedValue(new Error('no session')),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
    patchMe: vi.fn(),
    deleteMe: vi.fn(),
    getDashboard: vi.fn(),
    getCyberResources: vi.fn().mockRejectedValue(new Error('offline')),
  }
})

function renderApp(initial = ['/signin']) {
  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={initial}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('auth flow', () => {
  it('signs in and navigates to dashboard with mocked API', async () => {
    const user = userEvent.setup()
    ;(api.login as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ access_token: 'tok', user: { id: '1', email: 'u@test.com', name: 'User', role: 'user' } })
    ;(api.getDashboard as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ total_analyses: 0 })
    renderApp(['/signin'])
    await screen.findByRole('heading', { name: /sign in/i })
    await user.type(screen.getByLabelText(/email/i), 'u@test.com')
    await user.type(screen.getByLabelText(/^password$/i), 'secret123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(api.login).toHaveBeenCalled())
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
  })
})
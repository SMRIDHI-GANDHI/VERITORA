import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider'
import { AuthProvider } from '../auth/AuthContext'
import { AppRoutes } from '../App'
import '../i18n'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    refresh: vi.fn().mockResolvedValue({ access_token: 'tok', user: { id: '1', email: 'u@test.com', name: 'User', role: 'user', preferred_language: 'en', explanation_language: 'en', theme: 'system' } }),
    getMe: vi.fn().mockResolvedValue({ id: '1', email: 'u@test.com', name: 'User', role: 'user', preferred_language: 'en', explanation_language: 'en', theme: 'system' }),
    patchMe: vi.fn().mockResolvedValue({ id: '1', email: 'u@test.com', name: 'User', role: 'user' }),
    deleteMe: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getCyberResources: vi.fn().mockRejectedValue(new Error('offline')),
  }
})

describe('Settings deletion dialog', () => {
  it('traps focus within dialog', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/settings']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>,
    )
    await screen.findByRole('heading', { name: /settings/i })
    await user.click(screen.getByRole('button', { name: /request deletion/i }))
    const cancel = await screen.findByRole('button', { name: /cancel/i })
    const confirm = screen.getByRole('button', { name: /confirm request/i })
    expect(cancel).toHaveFocus()
    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(cancel).toHaveFocus()
  })
})
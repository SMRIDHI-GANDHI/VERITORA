import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AppRoutes } from '../App'
import { ThemeProvider } from '../theme/ThemeProvider'
import { AuthProvider } from '../auth/AuthContext'
import '../i18n'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    refresh: vi.fn().mockRejectedValue(new Error('no session')),
    getCyberResources: vi.fn().mockRejectedValue(new Error('offline')),
  }
})

describe('language switch', () => {
  beforeEach(() => localStorage.clear())
  it('switches UI language and persists', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/help/cybercrime']}>
            <AppRoutes />
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>,
    )
    const select = await screen.findByLabelText(/^Language$|^भाषा$/i)
    await user.selectOptions(select, 'hi')
    expect(localStorage.getItem('veritrust-ui-lang')).toBe('hi')
  })
})
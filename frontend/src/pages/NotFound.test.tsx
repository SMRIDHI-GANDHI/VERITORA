import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import i18n from '../i18n'
import { AuthContext, type AuthState } from '../auth/auth-context'
import { NotFound } from './NotFound'

const auth: AuthState = {
  user: null,
  loading: false,
  login: vi.fn(async () => {}),
  register: vi.fn(async () => {}),
  logout: vi.fn(async () => {}),
  refreshMe: vi.fn(async () => {}),
}

function renderNotFound() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/missing-page']}>
          <NotFound />
        </MemoryRouter>
      </AuthContext.Provider>
    </I18nextProvider>,
  )
}

describe('NotFound', () => {
  it('explains the missing page and offers useful routes', () => {
    renderNotFound()

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to home' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin')
    expect(screen.getByRole('link', { name: 'Report cybercrime' })).toHaveAttribute('href', '/help/cybercrime')
    expect(screen.queryByRole('link', { name: 'Open dashboard' })).not.toBeInTheDocument()
  })
})

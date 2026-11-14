import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider'
import { AuthProvider } from './AuthContext'
import { ProtectedRoute } from './guards'
import '../i18n'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    refresh: vi.fn().mockRejectedValue(new Error('no session')),
    getCyberResources: vi.fn().mockRejectedValue(new Error('offline')),
  }
})

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to signin', async () => {
    render(
      <ThemeProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/private']}>
            <Routes>
              <Route path="/private" element={<ProtectedRoute><div>Private</div></ProtectedRoute>} />
              <Route path="/signin" element={<div>Sign In Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </ThemeProvider>,
    )
    expect(await screen.findByText('Sign In Page')).toBeInTheDocument()
  })
})
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from './ThemeProvider'
import { useTheme } from './useTheme'

function Harness() {
  const { theme, setTheme, resolved } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={() => setTheme('dark')}>dark</button>
      <button onClick={() => setTheme('light')}>light</button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => localStorage.clear())
  it('defaults to system and persists selection', async () => {
    const user = userEvent.setup()
    render(<ThemeProvider><Harness /></ThemeProvider>)
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    await user.click(screen.getByText('dark'))
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(localStorage.getItem('veritrust-theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
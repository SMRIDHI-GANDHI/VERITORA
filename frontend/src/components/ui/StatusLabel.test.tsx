import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '../../i18n'
import { StatusLabel } from './StatusLabel'

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe('StatusLabel', () => {
  it('includes text label (not color-only)', () => {
    renderWithI18n(<StatusLabel status="warning" />)
    expect(screen.getByText(/warning|चेतावनी/i)).toBeInTheDocument()
  })
})
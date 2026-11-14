import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import i18n from '../i18n'
import { Analyze } from './Analyze'

function renderAt(path: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Analyze />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

describe('Analyze tabs', () => {
  it('opens the message tab from the ?tab=message deep link', () => {
    renderAt('/analyze?tab=message')

    expect(screen.getByRole('heading', { level: 1, name: 'Message analyzer' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Conversation' })).toBeInTheDocument()
    expect(screen.queryByLabelText(/Job title/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze message' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to the job tab for an unknown tab parameter', () => {
    renderAt('/analyze?tab=unknown')

    expect(screen.getByRole('heading', { level: 1, name: 'Job analyzer' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Job title/)).toBeInTheDocument()
  })
})

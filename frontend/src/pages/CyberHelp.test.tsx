import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { vi } from 'vitest'
import i18n from '../i18n'
import { CyberHelp } from './CyberHelp'

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return { ...actual, getCyberResources: vi.fn().mockRejectedValue(new Error('offline')) }
})

describe('CyberHelp', () => {
  it('renders primary tel link and portal link with fallback', async () => {
    render(<I18nextProvider i18n={i18n}><CyberHelp /></I18nextProvider>)
    expect(await screen.findByRole('link', { name: /call 1930/i })).toHaveAttribute('href', 'tel:1930')
    const portal = screen.getByRole('link', { name: /cybercrime\.gov\.in/i })
    expect(portal).toHaveAttribute('href', 'https://cybercrime.gov.in/')
    expect(screen.getByText(/VERITORA is not the official portal/i)).toBeInTheDocument()
  })
})
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import i18n from '../i18n'
import { Chat } from './Chat'

const mockCreateChatSession = vi.fn()
const mockGetChatSession = vi.fn()
const mockPostChatMessage = vi.fn()

vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api')
  return {
    ...actual,
    createChatSession: (p: unknown) => mockCreateChatSession(p),
    getChatSession: (id: string) => mockGetChatSession(id),
    postChatMessage: (id: string, m: string) => mockPostChatMessage(id, m),
  }
})

function renderChat(path = '/chat') {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Chat />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

const assistantMessage = {
  id: 'm2',
  session_id: 's1',
  role: 'assistant' as const,
  content: 'The stored analysis gives a risk indicator of 76/100 (band very_high_concern).',
  citations: ['ev:analysis', 'ev:factor:UPFRONT_PAYMENT'],
  statement_types: ['fact', 'ai_interpretation'] as const,
  mode: 'templated',
  created_at: '2026-11-14T00:00:00Z',
}

describe('Chat', () => {
  beforeEach(() => {
    mockCreateChatSession.mockReset()
    mockGetChatSession.mockReset()
    mockPostChatMessage.mockReset()
    mockCreateChatSession.mockResolvedValue({ id: 's1', analysis_id: null })
    mockGetChatSession.mockResolvedValue({ id: 's1', messages: [] })
  })

  it('creates a session on mount and shows the empty state', async () => {
    renderChat()
    await waitFor(() => {
      expect(mockCreateChatSession).toHaveBeenCalled()
    })
    expect(await screen.findByText(/ask a question about a job posting/i)).toBeInTheDocument()
  })

  it('grounds the session on the analysis in the URL', async () => {
    renderChat('/chat?analysis=abc-123')
    await waitFor(() => {
      expect(mockCreateChatSession).toHaveBeenCalledWith({ analysis_id: 'abc-123' })
    })
  })

  it('sends a question and renders the grounded answer with evidence', async () => {
    mockPostChatMessage.mockResolvedValue({
      session_id: 's1',
      stored: true,
      warning: null,
      injection_detected: false,
      user_message: {
        id: 'm1',
        session_id: 's1',
        role: 'user',
        content: 'Should I pay the fee?',
        citations: [],
        statement_types: [],
        mode: null,
        created_at: null,
      },
      assistant_message: assistantMessage,
    })

    const user = userEvent.setup()
    renderChat()

    await user.type(await screen.findByLabelText(/ask about verification/i), 'Should I pay the fee?')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    await waitFor(() => {
      expect(mockPostChatMessage).toHaveBeenCalledWith('s1', 'Should I pay the fee?')
    })
    expect(
      await screen.findByText(/risk indicator of 76\/100/i),
    ).toBeInTheDocument()
    // Statement-type chips are rendered.
    expect(screen.getByText('Fact')).toBeInTheDocument()
    expect(screen.getByText('AI interpretation')).toBeInTheDocument()
    // Citations are rendered as readable evidence labels.
    expect(screen.getByText('Stored analysis')).toBeInTheDocument()
    expect(screen.getByText('Risk factor: UPFRONT_PAYMENT')).toBeInTheDocument()
  })

  it('shows the server warning when a credential message is refused', async () => {
    mockPostChatMessage.mockResolvedValue({
      session_id: 's1',
      stored: false,
      warning: 'Your message appeared to contain a password and was not stored.',
      injection_detected: false,
      user_message: null,
      assistant_message: { ...assistantMessage, id: 'm3' },
    })

    const user = userEvent.setup()
    renderChat()

    await user.type(await screen.findByLabelText(/ask about verification/i), 'my password is x')
    await user.click(screen.getByRole('button', { name: /^send$/i }))

    expect(await screen.findByText(/appeared to contain a password/i)).toBeInTheDocument()
  })

  it('warns client-side about credential-like input before sending', async () => {
    const user = userEvent.setup()
    renderChat()

    await user.type(await screen.findByLabelText(/ask about verification/i), 'my OTP is 123456')
    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent(/do not share it here/i)
  })

  it('surfaces an error state when the session cannot be created', async () => {
    mockCreateChatSession.mockRejectedValue(new Error('offline'))
    renderChat()
    expect(await screen.findByText(/could not start a chat session/i)).toBeInTheDocument()
  })
})

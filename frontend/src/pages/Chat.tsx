import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  createChatSession,
  getChatSession,
  postChatMessage,
  type ChatMessage as ApiChatMessage,
  type ChatStatementType,
} from '../lib/api'
import { ErrorState } from '../components/ui/ErrorState'
import { Masthead } from '../components/ui/Masthead'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'
import { Icon } from '../components/ui/Icon'

const SENSITIVE_RE = /\b(password|passwd|otp|one[- ]?time|cvv|pin|banking credential)\b/i

const STATEMENT_LABELS: Record<ChatStatementType, string> = {
  fact: 'Fact',
  user_report: 'User report',
  ai_interpretation: 'AI interpretation',
}

const STATEMENT_HINTS: Record<ChatStatementType, string> = {
  fact: 'Recorded by the VERITORA rule engine or an approved source.',
  user_report: 'An allegation submitted by a user. Not a verified fact.',
  ai_interpretation: 'General guidance, not a verified fact.',
}

type UiMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  statementTypes: ChatStatementType[]
  citations: string[]
  mode?: string | null
  local?: boolean
}

/** Turn an evidence id such as `ev:factor:UPFRONT_PAYMENT` into readable text. */
function citationLabel(citation: string): string {
  const parts = citation.split(':')
  const kind = parts[1] ?? ''
  const detail = parts.slice(2).join(':')
  switch (kind) {
    case 'analysis':
      return 'Stored analysis'
    case 'factor':
      return `Risk factor: ${detail}`
    case 'check':
      return `Check: ${detail}`
    case 'community':
      return 'Approved community reports'
    case 'recommendation':
      return `Recommendation: ${detail}`
    case 'unknown':
      return 'Known unknowns'
    case 'resource':
      return `Official resource: ${detail}`
    default:
      return citation
  }
}

function fromApi(m: ApiChatMessage): UiMessage {
  return {
    id: m.id,
    role: m.role,
    text: m.content,
    statementTypes: (m.statement_types || []) as ChatStatementType[],
    citations: m.citations || [],
    mode: m.mode,
  }
}

export function Chat() {
  const [searchParams] = useSearchParams()
  const analysisId = searchParams.get('analysis') || undefined
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [degraded, setDegraded] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const sensitive = useMemo(() => SENSITIVE_RE.test(input), [input])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const created = await createChatSession(analysisId ? { analysis_id: analysisId } : {})
      setSessionId(created.id)
      const detail = await getChatSession(created.id)
      setMessages(detail.messages.map(fromApi))
    } catch {
      setError('Could not start a chat session. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [analysisId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const el = bottomRef.current
    // Guarded: scrollIntoView is not implemented in jsdom.
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'end' })
    }
  }, [messages])

  async function send() {
    const question = input.trim()
    if (!question || !sessionId || sending) return
    setSending(true)
    setError(null)
    setNotice(null)
    const optimistic: UiMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      text: question,
      statementTypes: [],
      citations: [],
      local: true,
    }
    setMessages((prev) => [...prev, optimistic])
    setInput('')
    try {
      const res = await postChatMessage(sessionId, question)
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id)
        const next = [...withoutOptimistic]
        if (res.user_message) next.push(fromApi(res.user_message))
        next.push(fromApi(res.assistant_message))
        return next
      })
      if (res.warning) setNotice(res.warning)
      setDegraded(res.assistant_message.mode === 'templated')
    } catch {
      setError('The assistant could not respond. Please try again.')
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(question)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <Masthead
        title="Verification chatbot"
        subtitle="Answers are grounded in your stored analysis and approved sources. Every answer labels its statements and cites the evidence behind them."
        aside={<Stamp lines={['Session', sessionId ? sessionId.slice(0, 8).toUpperCase() : 'starting']} tone="ink" />}
      />

      <p className="flex items-start gap-3 border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm leading-relaxed text-text">
        <Icon name="warning" size={16} className="mt-0.5 shrink-0 text-warning" />
        <span>Never share passwords, OTPs, banking credentials, or remote-access codes. VERITORA is not an official reporting portal.</span>
      </p>

      {sensitive && (
        <div role="alert" className="border-l-2 border-danger bg-danger/10 px-4 py-3 text-sm leading-relaxed text-danger">
          Warning: your message may contain sensitive credential information (password/OTP/PIN/banking).
          Do not share it here or with recruiters. It will not be stored.
        </div>
      )}

      {notice && (
        <div role="status" className="border-l-2 border-warning bg-warning/10 px-4 py-3 text-sm text-text">
          {notice}
        </div>
      )}

      {error && <ErrorState message={error} onRetry={load} />}

      <section className="space-y-5">
        <h2 className="sr-only">Messages</h2>

        <div className="space-y-4" aria-live="polite" aria-busy={sending}>
          {loading ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Starting a session…</p>
          ) : messages.length === 0 ? (
            <p className="max-w-[62ch] text-sm leading-relaxed text-muted">
              Ask a question about a job posting, a recruiter or how to report a scam. For example:
              “Should I pay a registration fee?”
            </p>
          ) : (
            messages.map((m) => (
              <article
                key={m.id}
                className={`border-l-2 px-4 py-3 ${
                  m.role === 'user' ? 'border-border bg-tint/40' : 'border-stamp bg-stamp/[0.05]'
                }`}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-muted">{m.role}</span>
                  {m.statementTypes.map((t) => (
                    <span
                      key={t}
                      title={STATEMENT_HINTS[t]}
                      className="border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-heading"
                    >
                      {STATEMENT_LABELS[t]}
                    </span>
                  ))}
                  {m.mode === 'templated' && (
                    <span className="border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-muted">
                      Rule-based answer
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{m.text}</p>

                {m.citations.length > 0 && (
                  <div className="mt-2.5 text-xs text-muted">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">Evidence</span>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {m.citations.map((c) => (
                        <li key={c} className="bg-tint px-2 py-0.5 font-mono text-[11px]">
                          {citationLabel(c)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        <div className="space-y-2.5 border-t border-border pt-4">
          <label htmlFor="chat-input" className={fieldLabelClass}>
            Ask about verification
          </label>
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                void send()
              }
            }}
            className={fieldClass}
            rows={4}
            placeholder="e.g. Should I pay a registration fee?"
            aria-describedby="chat-help"
          />
          <p id="chat-help" className="text-xs leading-relaxed text-muted">
            Press Ctrl+Enter to send. Answers are decision support, not a verdict — verify independently before you act.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button
              type="button"
              onClick={() => void send()}
              disabled={sending || !sessionId || !input.trim()}
            >
              {sending ? 'Thinking…' : 'Send'}
            </Button>
            <Button variant="secondary" type="button" onClick={() => void load()} disabled={sending}>
              New session
            </Button>
            <Link to="/help/cybercrime" className={buttonClass('secondary')}>
              Official cyber resources
            </Link>
            <Link to="/analyze" className={buttonClass('secondary')}>
              Run a check
            </Link>
          </div>
          {degraded && (
            <p className="text-xs text-muted">
              Answers are produced by the rule engine in this build, so wording is templated.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}

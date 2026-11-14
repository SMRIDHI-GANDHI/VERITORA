# B13 — Grounded chatbot and trend analytics
Agent: @backend-dev | Reads: 03 FR-CH, 08 (prompt injection)

## Build
- `chat_sessions`, `chat_messages`; `POST /chat/sessions`, `POST /chat/sessions/{id}/messages`.
- Retrieval: load the referenced analysis, its factors, verification checks, approved community summary, and official-resource config; build an evidence pack with ids.
- Responder: if `LLM_ENABLED`, call `LLMClient` with strict system preamble (answer only from evidence pack; label each statement as `fact`, `user_report`, or `ai_interpretation`; say "I can't tell" when evidence is missing; never ask for passwords/OTPs); output JSON schema with `answer`, `citations[]` (evidence ids), `statement_types`. Validate; on failure or LLM off, use templated explanations from the rule engine.
- Cyber questions answer from resource config with official links.
- Input sanitization: user and retrieved text are data; strip instructions; max lengths; rate limit.
- Trend analytics: weekly counts of approved reports and rising patterns for moderator dashboard.

## Acceptance
Answers cite evidence ids that exist; no company facts invented (test with analysis lacking checks → states unknown); injection fixtures fail to alter behavior; works with LLM disabled; password/OTP request in chat triggers a warning and is not stored.

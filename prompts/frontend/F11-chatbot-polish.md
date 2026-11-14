# F11 — Chatbot UI and final accessibility/performance pass
Agent: @frontend-dev | Reads: 09, 06 (chat), 03 FR-CH

## Build
- `/chat` and in-result "Ask about this analysis" drawer: message list with `aria-live`, statement-type chips (fact / user report / AI interpretation), citations linking to evidence panels, "I can't tell from available information" rendering, warning banner if user types password/OTP-like content (client-side) with advice not to share.
- Official cyber resource links surfaced for relevant answers.
- Final pass: full axe sweep both themes, Lighthouse budgets (performance, a11y ≥ 95), code-splitting for admin/graph/chart bundles, reduced-motion audit, empty/error/partial state audit for every route, i18n missing-key check in CI, Playwright journeys A–E.

## Acceptance
All E2E journeys green; zero serious axe violations; i18n key parity en/hi enforced by test; bundle size report included in the phase report.

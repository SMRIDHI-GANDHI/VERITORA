# F03 — Job analyzer form and result page (primary screen)
Agent: @frontend-dev | Reads: 09 §3, 06 (AnalysisResult), 03 FR-JA/FR-RS

## Build
- `/analyze` form per `JobAnalyzeRequest` with validation, length counters, privacy hint ("don't paste passwords, OTPs, or ID numbers").
- `/analysis/:id` result page in the exact order of 09 §3: summary + `RiskBand` meter with text label and decision-support note; factor cards (severity + confidence chips, explanation, excerpt); **highlighted original text** panel using span offsets (safe rendering, no `dangerouslySetInnerHTML`); verification table; unknowns/not-checked list; prioritized recommendations; community context; actions (save, refresh, create passport, ask chatbot, translate) — unimplemented actions disabled with tooltip; footer with rules version, timestamp, disclaimer.
- Handles `insufficient_information` (no numeric meter, clear explanation of what to add).
- "Report Cybercrime" call-to-action appears when recommendation `CONTACT_1930_IF_PAID` is present.

## Acceptance
Rendering tests with fixtures: high concern, moderate, insufficient info, partial verification failure; snapshot of text containing XSS payload renders inert; no copy contains "fake/genuine" or percentage-probability wording (lint test over i18n files); both themes pass axe; mobile layout verified.

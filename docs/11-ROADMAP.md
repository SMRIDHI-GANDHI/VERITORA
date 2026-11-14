# 11 — Roadmap and Task Index

Rule: one task per OpenCode session, app runnable after each. Run `/next-task <ID>`. Briefs live in `prompts/backend/` and `prompts/frontend/`. Tag `phase-N` when a phase passes exit criteria.

## Phase 0 — Foundation
| ID | Task | Depends | Requirements |
|---|---|---|---|
| B01 | Backend scaffold, config, DB, Alembic, health, errors, logging, CI | – | NFR-* |
| B02 | Auth, users, RBAC, rate limit, audit log base | B01 | FR-AU, FR-AD-1 |
| F01 | Frontend scaffold, theme, i18n, layout, API client, cyber help page | – | FR-LG-1/3, FR-CY |
| B03 | Cyber resources endpoint + config | B01 | FR-CY |

## Phase 1 — MVP (hackathon core path)
| ID | Task | Depends | Requirements |
|---|---|---|---|
| B04 | Risk engine + job analyzer (rules, spans, recommendations) | B01 | FR-JA, FR-RS |
| B05 | Company verification service + adapters | B01 | FR-CV |
| B06 | Community reports, ratings, moderation, PII scan | B02 | FR-CR, FR-AD |
| F02 | Auth UI + app shell + dashboard skeleton | F01, B02 | FR-AU |
| F03 | Analyzer UI + result page | F01, B04 | FR-JA, FR-RS |
| F04 | Company verification UI | F03, B05 | FR-CV |
| F05 | Reports + ratings UI | F02, B06 | FR-CR |
| F06 | Admin moderation UI | F05 | FR-AD |
| B07 | Seed demo data + eval harness + E2E happy path | B04–B06 | test plan |

## Phase 2 — Differentiators
| ID | Task | Depends |
|---|---|---|
| B08 | Recruiter verification + URL scanner (SSRF) + message analyzer | B05 |
| B09 | Network detection (fingerprints, edges, alerts) | B06 |
| B10 | History, dashboard APIs, data exposure checker, recommendations, watchlist | B04, B06 |
| F07 | Recruiter/URL/message UI | B08 |
| F08 | Network graph + watchlist admin UI | B09, B10 |
| F09 | Dashboard, history, exposure checker UI | B10 |

## Phase 3 — Advanced
| ID | Task | Depends |
|---|---|---|
| B11 | Offer-letter upload, extraction, OCR, analysis | B04 |
| B12 | Trust Passport + translator/multilingual explanations | B10 |
| B13 | Grounded chatbot + trend/early-warning analytics | B10 |
| F10 | Passport, translator, offer-letter UI | B11, B12 |
| F11 | Chatbot UI + a11y/performance polish | B13 |

F11 status (delivered): grounded chat UI with citeable evidence, moderator trends page (`/admin/trends`), documented band labels across the app, axe sweep on all authenticated routes in light/dark, Playwright journeys A–E, reduced-motion verification, and Lighthouse-equivalent performance budgets via `npm run test:perf` (no new dependency).

Phase 3 follow-up: message analyzer delivered (`/message-analyzer` deep-links to `/analyze?tab=message`, per-message evidence highlighting and a separate conversation-escalation callout, en/hi strings, unit + E2E coverage). Landing and 404 delivered: `/` now carries the value proposition, quick check (prefills the job or URL analyzer), check paths, safety callout, and product principles; unmatched routes get a friendly, accessible 404. Translator phrase highlighting delivered: the result page translator panel now runs rule-based wording checks on evidence excerpts, highlights payment/urgency/secrecy/guarantee/off-channel clauses, and shows plain-language explanations with original text always visible; en/hi strings and unit tests cover it. My Passports delivered (authenticated owner-only `GET /api/v1/passports`, status/risk/summary/date display, revocation via existing authorized API, `/passports` UI with loading/empty/success/error states, en/hi strings). Appeals admin delivered (moderator/admin `GET /api/v1/admin/appeals` derived from existing `appeal_submitted` moderation actions, linked report details/message, admin queue UI with loading/empty/error states and handoff to report moderation; existing appeal submission and moderation flows preserved). Final Phase D verification (automated): frontend tests, lint, typecheck, build and backend pytest passed.

## Hackathon cut line
If time is short, stop after Phase 1 plus a thin slice of B09 (hash identifiers + shared-domain edge + moderator view) and F08. Priority order: company verification, reporting, network detection, risk scoring, analyzer, results/recommendations.

## Definition of done (every task)
Acceptance criteria met; tests added and green; lint/typecheck clean; contract and docs updated; `.env.example` updated; no TODOs hiding missing behavior; standard report delivered.

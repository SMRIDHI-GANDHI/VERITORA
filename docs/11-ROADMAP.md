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

---

## Phase E–G closure record (release-readiness evidence snapshot)

This section records the final Phase G closure state as of commit `749de22` / `origin/main` (2026-11-15). It is an evidence-based status record, not a claim of production readiness. Unexecuted checks remain **NOT VERIFIED**.

### Phase E — Security hardening and regression coverage
- **Status:** Complete (evidence-supported by delivered commits and automated gates).
- **Key commit:** `f16b67e` — `test(security): complete Phase E hardening and regression coverage`.
- **Scope delivered (summary):** SSRF hardening (DNS/public-IP validation, redirect revalidation/pinning behavior per implementation), HSTS in production/prod HTTPS contexts, placeholder/empty secret and runtime-config validation, CSRF defense-in-depth for cookie-auth flows, offer-letter consent/validation and related report/PII/rate-limiting hardening, verdict-language cleanup (`fake/genuine/scam_confirmed` prohibited), dependency alignment (`pydantic[email]>=2.9.0`) as previously recorded.

### Phase F — CI, PostgreSQL integration scaffolding, contract/ADRs, env templates/runbook
- **Status:** Complete (implementation/configuration and local automated gates evidence-supported). Remote CI execution for the closure commit was **NOT VERIFIED** in this session (no `gh`/GitHub Actions access available).
- **Key commits:** `12c5998` (`ci: add Playwright e2e and PostgreSQL-backed integration jobs`), `7146b96` (`docs: complete Phase F API contract and ADR updates`, ADRs `0005`–`0007`), `4109118` (`docs: complete Phase F environment templates and runbook`).
- **CI workflow (`.github/workflows/ci.yml`) jobs/configured:** `backend` (lint/typecheck/tests + `pytest -q --ignore=tests/integration_db`), `backend-integration-db` (PostgreSQL 16 service, `alembic upgrade head`, `pytest -q tests/integration_db` with JUnit enforcement: exactly 3 executed tests, zero failures/errors/skips), `frontend` (lint/typecheck/test/build), `frontend-e2e` (PostgreSQL 16, migrate+seed, Playwright Chromium install, `npm run test:e2e` with line+HTML reporter and artifact upload on failure).

### Phase G — Release readiness (Tasks 1–5)

| Task | Status | Evidence / notes |
|---|---|---|
| Part 1, Task 1 — Production configuration review (secrets/cookies/CORS/APP_ENV) | **Complete** | Commit `a57c151` (`hardening: complete Phase G Part 1 operational readiness`). Dev-like scoping for localhost CORS/CSRF conveniences, non-dev runtime config validation for `DATABASE_URL`/`SECRET_KEY`/`NETWORK_HMAC_KEY`, cookie/security behavior documented/implemented (`backend/app/config.py`, `backend/app/api/routes/auth.py`, `backend/app/main.py`, `backend/tests/unit/test_config.py`). |
| Part 1, Task 2 — Backup/restore and migration rollback policy | **Complete (policy/documentation)**; execution **NOT VERIFIED** | Commit `a57c151` added `docs/13-OPERATIONS-RECOVERY.md` (and `docs/README.md` index). Documented PostgreSQL backup/restore/runbook, Alembic rollback/forward-fix policy, cautions and proposed-vs-evidenced status. No destructive backup/restore/PITR/Alembic downgrade executed on real or disposable production-like database in this closure session. |
| Part 2, Task 3 — Observability, audit-log review, metrics, API docs | **Complete** | Commit `749de22` (`observability: complete Phase G Part 2 Tasks 3 and 4`). Structured request/error logging, enriched admin-only `/api/v1/admin/metrics` (audited `admin.metrics.view`) and redacted admin-only `/api/v1/admin/audit-logs` (limit/cursor/filters/order as implemented), focused tests, Admin UI/client/i18n updates, `docs/06-API-CONTRACT.md` aligned. |
| Part 2, Task 4 — Accessibility review and documentation alignment | **Complete (automated/static + CI-configured checks documented)**; browser axe E2E runtime **NOT VERIFIED** locally/CI in-session | Commit `749de22`. Contrast/theme and component/page accessibility-related tests pass locally; Playwright/axe specs exist and are CI-configured (`frontend-e2e`), but no GitHub Actions run was verified in this session. |
| Task 5 — Specification-conformance sweep and closure evidence | **Complete (sweep + local gates)** | No blocking code-level conformance failures identified against `docs/01`–`docs/11` DoD areas in implemented code/tests reviewed. Local gates passed (see below). Environment/operational gaps remain documented as NOT VERIFIED. |

### Verification evidence (local, 2026-11-15, commit `749de22` working tree before this docs-only closure commit)

| Check | Result | Evidence |
|---|---|---|
| Git/remote baseline | **PASS** | `main` clean and synced: `HEAD == origin/main == 749de226d6d9110fcee73167c21282286cc675fc` (`git status -sb`, `git fetch origin`, rev-parse). |
| Backend `python -m ruff check .` | **PASS** | `All checks passed!` |
| Backend `python -m mypy app` | **PASS** | `Success: no issues found in 90 source files` |
| Backend `python -m pytest -q` | **PASS** | `144 passed, 3 skipped, 28 warnings in 80.60s` (pre-existing: `slowapi` `asyncio.iscoroutinefunction` deprecation, `app/schemas/auth.py:15` Pydantic v2 class-config deprecation, `passlib` argon2 metadata warning). |
| Frontend `npm run lint` | **PASS** | `eslint .` clean |
| Frontend `npm run typecheck` | **PASS** | `tsc -b --pretty false` clean |
| Frontend `npm test -- --run` | **PASS** | `18 files, 96 tests passed` (Vitest v2.1.9; React Router future-flag warnings only) |
| Frontend `npm run build` | **PASS** | `vite v6.4.6` production build succeeded |
| Verdict-language scan | **PASS** | No `\b(fake|genuine|scam_confirmed)\b` matches in `backend/`, `frontend/src/`, `docs/` |
| i18n JSON validity/parity | **PASS** | `frontend/src/i18n/en.json` and `hi.json` parse OK; 230/230 keys, 0 missing each side |
| Alembic migration history/heads | **PASS (consistency check)** | Linear history `0001`→`0009_chat_sessions` (head); downgrade functions present in inspected migration files. `alembic current` against local configured DB reported head (informational; not a restore/downgrade drill). |
| GitHub Actions (all required jobs) for `origin/main`/closure commit | **NOT VERIFIED** | `gh` CLI and GitHub Actions API access unavailable in-session; no workflow run IDs/logs could be retrieved. CI configuration was inspected but execution/result must not be assumed. |
| PostgreSQL-backed integration job (`backend-integration-db`) actual CI execution | **NOT VERIFIED** | Workflow/config present and enforces expected integration tests/skips; no verified CI run evidence in-session. Local pytest suite passed but this does not substitute for verified CI job execution evidence. |
| Playwright + axe browser E2E (`frontend-e2e`) actual CI execution | **NOT VERIFIED** | Specs/config present and CI job configured (public/authenticated, light/dark journeys/a11y as implemented); no local browser E2E run and no verified CI run evidence in-session. |
| Real OCR/PDF/image extraction success paths | **NOT VERIFIED** | Local environment missing optional deps/tools: `PyMuPDF/fitz`, `Pillow/PIL`, `pytesseract`, and `tesseract` executable not found. Behavior should remain classified as degraded/inconclusive when unavailable. |
| Backup/restore, PITR, Alembic downgrade execution drill | **NOT VERIFIED** | `docs/13-OPERATIONS-RECOVERY.md` provides policy/runbook; no destructive or production-like restore/downgrade drill executed (no safe isolated disposable DB exercise performed in-session). |
| Committed `docs/openapi.json` artifact | **NOT APPLICABLE** | Repository does not maintain a committed OpenAPI JSON snapshot by design/current state; FastAPI serves runtime `/openapi.json`. `docs/06-API-CONTRACT.md` is the maintained contract reference. |

### Known limitations (non-exhaustive, honest)
- **CI evidence gap:** Required GitHub Actions job outcomes for the relevant commits/final closure commit were not verifiable in this environment; green status must not be assumed.
- **OCR capability:** Real PDF/image OCR success paths not verified locally due to missing optional dependencies/tools.
- **Operational recovery execution:** Backup/restore/PITR and Alembic downgrade/forward-fix outcomes are documented but not executed/validated in an isolated drill during this closure.
- **OpenAPI artifact:** No committed `docs/openapi.json`; runtime spec only.
- **Warnings (pre-existing, non-blocking):** `slowapi` coroutine deprecation warning, Pydantic v2 class-based config deprecation in `app/schemas/auth.py:15`, `passlib` argon2 metadata warning, and frontend React Router v7 future-flag/test-environment warnings.

### Release-readiness note
Automated local quality gates passed and no blocking code-level conformance defects were identified in this closure pass; however, **important CI/operational/environment checks remain unverified** (notably remote GitHub Actions execution for required jobs, browser axe E2E runtime evidence, PostgreSQL integration CI evidence, OCR success paths, and restore/downgrade drills). This does **not** constitute production readiness without the required operational and CI evidence.

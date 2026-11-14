# 10 — Test Plan

## 1. Pyramid
Unit (rules, scoring, normalizers, SSRF validator, PII scanner) → Integration (API + DB with testcontainers/compose Postgres) → Contract (OpenAPI diff, frontend types) → E2E (Playwright) → Accessibility (axe) → Security suite → AI evaluation.

## 2. Backend must-have tests per task
Success path, validation error, authz (each role), degraded external source, idempotency where relevant, migration up/down.

## 3. Functional scenarios (from brief §12)
Empty/malformed descriptions; with/without salary; generic recruiter email vs company-domain email; company with little online presence; URL redirects and blocked pages; PDF/image offer letters; multilingual and mixed-language text; conversation escalation (benign opening → payment/urgency, with evidence spans per message); duplicate/conflicting reports; ratings abuse; light/dark consistency; user/moderator/admin permissions.

## 4. AI evaluation
Labeled test set (synthetic, clearly labeled; licensed data only). Report precision, recall, F1, confusion matrix; FP analysis on legitimate startups; FN analysis on indirect payment requests; per-language metrics where data allows; human review of high-impact warnings; calibration before any probability wording. Script: `python -m app.eval.run --set payment_v1`.

## 5. Demo scenarios (synthetic, labeled)
1. Posting with upfront registration payment. 2. Conversation that gradually adds pressure then payment. 3. Offer letter with inconsistent contact info. 4. Three postings sharing a domain/template (possible network link, shown as lead). 5. Pending-moderation report — shown as "pending", not as fraud.
Seed with `python -m app.scripts.seed_demo`; every record `is_synthetic=true` and badged in UI.

## 6. E2E journeys
A (check job → result), B (verify company), C (submit report → moderator approves → appears neutral), D (moderator reviews alert), E (cyber help: links + tel), a landing quick check that prefills the analyzer, and a message-analyzer check (benign opening → payment/urgency escalation with per-message highlights).

### 6.1 Playwright harness
- `cd frontend && npm run test:e2e` — public + authenticated axe sweep, journeys A–E plus the landing quick-check and message-analyzer escalation checks, skip-link keyboard check, reduced-motion check. Requires a migrated database and seeded demo accounts (`cd backend && python -m app.scripts.seed_demo`). Outside CI, Playwright reuses running backend/Vite servers; otherwise it starts `uvicorn` and `npm run dev`.
- `cd frontend && npm run test:perf` — builds and previews the production bundle, then asserts LCP < 2500 ms, CLS < 0.1, TTFB < 800 ms on `/`, total JS < 700 KiB and largest JS chunk < 420 KiB. This is the Lighthouse-equivalent budget; no extra dependency is used.
- Auth: `e2e/global-setup.ts` logs in the two demo accounts **once per run** and writes access tokens to `e2e/.auth/tokens.json`. Each test fulfils `/auth/refresh` with that token (`e2e/fixtures.ts`), so parallel workers never share a rotating refresh cookie and stay under the 5/minute login limit.
- Axe coverage: `/`, `/help/cybercrime` and an unmatched route (unauthenticated); `/dashboard`, `/analyze`, `/trustscan`, `/verify/company`, `/verify/recruiter`, `/reports`, `/reports/new`, `/history`, `/saved`, `/exposure`, `/chat`, `/settings`, `/message-analyzer` (user); `/admin`, `/admin/network`, `/admin/watchlist`, `/admin/trends` (moderator) — each in light and dark, serious/critical violations = 0.
- Journey C writes a uniquely named synthetic report and approves it through the moderator API. The report remains in the database, labelled user-submitted and moderated (the platform has no hard-delete path).

## 7. Exit criteria per phase
All phase task acceptance criteria met; lint/typecheck/tests green; no open P0 security findings; docs updated; phase report produced.

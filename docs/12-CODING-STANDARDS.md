# 12 — Coding Standards

## General
Small functions, explicit types, no dead code, no commented-out code, no secrets, meaningful names, comments explain *why*. Product-language rules apply to code identifiers and strings: never name a status or string `fake`/`genuine`/`scam_confirmed`.

## Python (backend)
- Python 3.12, `ruff` (lint + format), `mypy --strict` on `app/`. Pydantic v2 models for I/O; SQLAlchemy 2 typed `Mapped[]`.
- Router → service → repository. Routers only parse, authorize, call service, shape response.
- Dependency injection via FastAPI `Depends`; no global mutable state.
- Async where I/O-bound (httpx, DB); CPU-heavy text work stays sync in service layer.
- Config via `pydantic-settings`; no `os.environ` reads outside `config.py`.
- Errors: raise domain exceptions mapped to problem JSON in one place.
- Logging: structured, request_id, no PII/secrets.
- Tests: pytest, factories/fixtures, deterministic (freeze time, seed), no network calls (mock adapters).
- Migrations: one per schema change, reversible, named descriptively.

## TypeScript (frontend)
- `strict: true`, no `any`, no non-null assertions without comment. ESLint + Prettier + `jsx-a11y`.
- Types generated/mirrored from OpenAPI (`openapi-typescript`); API calls only via `lib/api`.
- Components: small, accessible primitives; props typed; no business rules in components beyond display.
- State: TanStack Query for server state; avoid global stores unless needed.
- All user-visible strings via i18n keys (no hardcoded English); keys namespaced by feature.
- Styling: Tailwind utilities + tokens; no inline hex colors outside tokens.
- Tests: Vitest + Testing Library for states (loading/empty/error/partial), Playwright for journeys, axe for a11y.

## Git and review
Conventional Commits; `feat/B04-job-analyzer` branch naming; PR template lists task ID, requirements covered, tests, screenshots (light + dark), known limitations. Use `/verify-spec` and `/security-review` before merging.

## Definition of "works end to end"
Frontend action → API → DB → response → UI, exercised by an automated test or a documented manual run with real output.

# F02 — Auth UI, protected routes, dashboard skeleton, settings
Agent: @frontend-dev | Reads: 09, 06 (auth, /me), 03 FR-AU

## Build
- Sign in / sign up forms (accessible labels, inline validation, generic error messages), auth context with access token in memory + silent refresh via cookie, protected and role-gated route wrappers.
- Settings page: profile, interface language, explanation language, theme (synced to `/me`), account/data deletion request with confirmation dialog.
- Dashboard skeleton with cards (total analyses, recent, saved, report statuses, history) using loading/empty/error states; wired to endpoints as they exist (graceful placeholders otherwise).

## Acceptance
Unauthenticated users redirected; role gating hides admin routes and API 403 handled; theme/language persist to account; tests for auth flow with mocked API, protected route behavior, deletion dialog focus trap.

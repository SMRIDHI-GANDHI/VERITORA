# F01 — Frontend scaffold, theme, i18n, layout, cyber help
Agent: @frontend-dev | Reads: 02-TRD, 09-UI-UX, 06 ("Cyber resources"), 12

## Build
- `frontend/` Vite + React 18 + TS strict, Tailwind (class dark mode), ESLint (`jsx-a11y`), Prettier, Vitest + Testing Library, Playwright config, axe test helper.
- Design tokens as CSS variables for light and dark (navy/cyan palette per 09); no flash of wrong theme (inline bootstrap script); `ThemeProvider` with light/dark/system, persisted to localStorage (profile sync added in F02).
- `react-i18next` with `en.json`, `hi.json` (namespaced by feature); separate interface language and explanation language settings; Devanagari font fallback.
- App shell: header (logo, nav, theme toggle, language selector, always-visible **Report Cybercrime** link), footer with disclaimer, skip-to-content link, route skeleton for all pages in 09 (placeholders OK).
- `lib/api` typed client (fetch wrapper, problem-JSON error parsing, bearer handling stub), env `VITE_API_BASE_URL`.
- Shared UI primitives: `StatusLabel` (icon + text for checked/warning/inconclusive/not_checked/under_review), `RiskBand`, `Skeleton`, `EmptyState`, `ErrorState` (shows request id + retry), `ExternalLink` (`rel="noopener noreferrer"`, new tab).
- `/help/cybercrime` page rendering resources from `GET /resources/cybercrime` with static fallback identical to the contract; `tel:1930` link; copy stating VeriTrust is not the official portal and doesn't file complaints; CERT-In section noting it is not a replacement for a police/cybercrime complaint.

## Acceptance
`npm run dev` runs; theme and language switch work across all placeholder pages and persist; axe has no serious violations in both themes on shell + help page; keyboard-only navigation works; tests for ThemeProvider, language switch, StatusLabel (not color-only), cyber page links/`tel:`.

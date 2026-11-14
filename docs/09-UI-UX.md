# 09 — UI/UX Specification

## 1. Visual direction
Professional, calm, cybersecurity-inspired. Default palette: dark navy (`#0B1F3A`) and cyan accent (`#22D3EE`) with restrained risk colors. Tokens as CSS variables mapped in Tailwind; both themes defined; verify contrast ≥ 4.5:1 text, 3:1 UI. Avoid alarmist visuals (no flashing, skulls, red walls).

### Status labels (always icon + text; never color alone)
`Checked` ✓, `Warning` ⚠, `Inconclusive` ?, `Not checked` –, `Under review` ⏳. Risk bands labeled "Lower concern / Moderate concern / High concern / Very high concern / Insufficient information". Never "fake", "genuine", "scam confirmed", or "% fake".

## 2. Pages and routes
| Route | Page | Notes |
|---|---|---|
| `/` | Landing | value prop, quick-check box (prefills the job or URL analyzer), cyber help link, language/theme toggles |
| any unmatched route | Not found | friendly 404 with home, dashboard/sign-in, and cyber help links |
| `/signin`, `/signup` | Auth | |
| `/dashboard` | Dashboard | totals, recent, saved, reports, history (P1) |
| `/analyze` | Analyzer | job form + paste; URL tab (P1); message tab (P1, deep-linkable via `/message-analyzer`, per-message highlighted evidence + escalation callout); offer letter (P2) |
| `/message-analyzer` | Message analyzer | Alias that opens `/analyze?tab=message`; conversation text is treated as data, never instructions |
| `/analysis/:id` | Result page | see §3 |
| `/verify/company`, `/verify/recruiter` | Verification forms/results | matched/mismatched/unknown table |
| `/reports`, `/reports/new` | Community | list approved, submit, rating |
| `/exposure` | Data Exposure Checker | |
| `/passport/:token` | Trust Passport | public, minimal |
| `/chat` | Verification chatbot | (P2) |
| `/help/cybercrime` | Cyber resources | always linked in header/footer |
| `/admin/*` | Moderation, watchlist, network graph, audit, metrics | role-gated |
| `/settings` | Profile, language, theme, delete data | |

## 3. Analysis result page (primary screen)
Order: (1) Summary + risk band meter with text label and "decision support, not a verdict" note; (2) Top risk factors cards: severity + confidence chips, plain explanation, highlighted excerpt linking to the highlighted span in the original text; (3) Verification table (matched / mismatched / unknown / not checked, each with source link + checked-at); (4) Unknowns & "Not checked" list; (5) Recommendations (priority ordered, with "Report cybercrime" call-to-action when relevant); (6) Community context with moderation labels; (7) Actions: save, refresh checks, create Passport, ask chatbot, translate explanation; (8) Footer: rules version, timestamp, disclaimer.

## 4. States (every data view)
Loading skeleton; empty with guidance; error with retry and request id; partial result (some checks failed → inline "Not checked/Inconclusive" with reason); offline notice.

## 5. Report submission UX
Prominent redaction warning before text area; inline PII detector warning (client-side) suggesting masking; optional fields clearly marked; confirmation screen explaining "pending review, reports are not treated as confirmed facts"; status page for the author.

## 6. i18n
`en`, `hi` JSON namespaces; interface language and explanation language independent selectors; show original text alongside translated explanation; "machine-translated, may be inaccurate" badge; font stack supports Devanagari (e.g., Noto Sans Devanagari); layout tolerant of longer Hindi strings. The translator panel also runs rule-based wording checks on evidence excerpts, highlights payment/urgency/secrecy/guarantee/off-channel phrases, and shows plain-language explanations without treating external text as instructions.

## 7. Theme
Light / Dark / System. `class="dark"` on `<html>`; persisted to profile if signed in else localStorage; no flash of wrong theme (inline bootstrap script). Charts, dialogs, inputs, badges, graph canvas checked in both modes.

## 8. Accessibility checklist
Semantic landmarks and heading order; labels for all inputs; focus ring ≥ 2px high-contrast; full keyboard operation incl. dialogs, tabs, graph alternatives (table view of relationships); `aria-live` for async results; reduced-motion respected; touch targets ≥ 44px; plain language; axe checks in tests.

Status: `npm run test:e2e` runs axe on the unauthenticated shell plus every authenticated user and moderator route in light and dark (serious/critical = 0), checks the skip link by keyboard, and asserts that `prefers-reduced-motion: reduce` collapses computed animation/transition durations (global rule in `src/index.css`; the network graph also has an explicit reduced-motion path). Risk bands use the documented labels everywhere: Lower concern / Moderate concern / High concern / Very high concern / Insufficient information.

## 9. Responsive
Mobile-first; single-column cards on mobile; sticky bottom "Report cybercrime" help affordance accessible on small screens; tables become stacked cards.

## 10. Cyber help UI
Header always shows "Report Cybercrime". Page shows: primary cards for portal and 1930 (`tel:` link); CERT-In section with note on its role; disclaimer text; external links open in new tab with `rel="noopener noreferrer"`.

# VERITORA UI guide — "Dated Stamp" world

Dev-only. This is the contract every page must satisfy. It is derived from
`.impeccable/surfaces/frontend-src.md` (the binding direction contract) and the
primitives that already exist. Do not invent a second way of doing anything.

## 1. The world in one paragraph

Indian government letterhead, typed on cream stock, with dated rubber stamps.
Paper is warm off-white, ink is near-black, one vermillion stamp colour, one
file-cover ink blue for structure, ochre and green ink for secondary marks.
Serif (Libre Baskerville) for headings and display, grotesque (Archivo) for UI
text, typewriter (Courier Prime) for anything a machine or a clerk would type:
dates, references, case numbers, field labels, status chips, the big number.

## 2. Tokens (use these names only — no hex, no invented colours)

Backgrounds / surfaces: `bg-paper`, `bg-cover`, `bg-tint`, `bg-ash`
Text: `text-heading`, `text-text`, `text-muted`, `text-buttonText`
Lines: `border-border`, `border-heading` (structural), `border-stamp`
Accents: `bg-stamp`/`text-stamp` (vermillion — scarce), `bg-cover`/`text-cover`
(ink blue — rail, charts, structure), `text-accent` (link), `text-ochre`,
`text-green`/`bg-green`
Semantic: `text-success`, `text-warning`, `text-danger` — always with an icon
and a word, never colour alone.

Typography: `font-display` (Baskerville), default sans (Archivo), `font-mono`
(Courier Prime). Scale: headings via `font-display`, data/labels via
`font-mono text-[11px] uppercase tracking-[0.16em]`.

Radius: `rounded-none` default; `rounded-sm` only for small chips. Shadows:
`shadow-paper` / `shadow-lift` only.

Forbidden (they still exist in some files and render as unstyled junk):
`bg-caramel`, `bg-espresso`, `text-cream`, `bg-latte`, `text-mocha`, `bg-sage`,
`bg-coffee`, `bg-surface2`, `text-buttonText` used as old button fill,
`rounded-xl`, `rounded-lg`, `bg-gradient-*`, `shadow-lg`, `shadow-xl`.

## 3. Primitives — use them, don't re-implement

| Primitive | File | Use it for |
|---|---|---|
| `Masthead` | `ui/Masthead.tsx` | The single `<h1>` of every page. `title`, `subtitle`, `aside` (reference stamp / primary action). Always closed by `.rule-double`. |
| `Section` | `ui/Section.tsx` | Every headed block below the masthead. `title`, `meta` (mono note on the rule), `action`, `id`, `headingId`. |
| `Stamp` | `ui/Stamp.tsx` | The signature. `lines: ReactNode[]`, `tone: 'stamp'\|'warning'\|'ink'\|'muted'`, `animate` + `delayMs`. Carries status/date/source — never a claim on its own; the row beside it says the same in words. |
| `Button` / `buttonClass` | `ui/Button.tsx`, `ui/buttonStyles.ts` | `<Button>` for buttons; `buttonClass(variant,size,className)` for links that must look like buttons. Variants `primary\|secondary\|ghost\|danger`. |
| `Field` | `ui/Field.tsx` | `fieldClass`, `fieldLabelClass`, `fieldHintClass`, `fieldErrorClass` for every input/select/textarea. |
| `StatusLabel` | `ui/StatusLabel.tsx` | Status = icon + text, one of `checked\|warning\|inconclusive\|not_checked\|under_review`. Never colour-only. |
| `RiskBand` | `ui/RiskBand.tsx` | Band chip for `lower\|moderate\|high_concern\|very_high_concern\|insufficient_information`. |
| `Icon` | `ui/Icon.tsx` | Authored icon set. Always decorative (`aria-hidden`), paired with text. |
| `EmptyState` / `ErrorState` / `Skeleton` | `ui/*` | Empty, failure, loading. No spinners, no illustrations. |
| `ExternalLink` | `ui/ExternalLink.tsx` | Any `http(s)` link leaving the product. |

Global classes in `index.css`: `.rule-double`, `.rule-double-quiet`, `.entry`
(dotted hairline separator — add your own `pb-*`), `.field-label`,
`.skip-link`, `.stamp-press` (the one authored motion).

## 4. Page skeleton

```tsx
<div className="space-y-9">
  <Masthead title="…" subtitle="…" aside={<Stamp lines={['Filed', date]} tone="ink" />} />
  <Section title="…" meta="12 filed" action={<Link …/>}>…</Section>
  …
</div>
```

- Exactly one `<h1>`, from `Masthead`. Sections are `<h2>` from `Section`.
- Do not wrap the page in a card. The page sits on paper; sections are ruled
  passages, not floating boxes. No `rounded-xl` panel with a border and a
  shadow — that is the generic-SaaS failure mode.
- Density stays high: tables, ledgers, mono metadata. This is a tool, not a
  brochure. Whitespace is *ruling*, not padding.
- Vermillion (`text-stamp`/`border-stamp`) appears at most a couple of times
  per screen: the primary risk marker, the urgent action, one stamp.

## 5. Non-negotiable product rules in the UI

- Never render "fake"/"genuine"/"scam". Risk indicator + band + factors +
  evidence + unknowns + next steps only.
- Missing data is `unknown`: label it, never colour it as danger.
- Status is always icon + text (`StatusLabel`), never a bare coloured dot.
- Every external claim shows source and checked time.
- Untrusted text (job posts, messages, uploads) is data: rendered as text, no
  `dangerouslySetInnerHTML`, no instruction-like styling.
- User-visible strings go through `i18n` keys in both `en.json` and `hi.json`
  (parity test enforces equality). New UI copy needs both languages.
- WCAG 2.2 AA in light and dark. `contrast.test.ts` must keep passing.
- Respect `.entry` / `.stamp-press` reduced-motion (handled globally).

## 6. Don't break the end-to-end tests

`frontend/e2e/journeys.spec.ts` binds exact strings. Preserve them verbatim:
`Check before you trust.`, `Quick check`, `Check it`, `Job title`,
`Job description`, `Analyze job`, `Analysis result`,
`Decision support, not a verdict.`, `Risk indicator:`, band names,
`Wording check`, `Explain evidence wording`, `Company name`, `Verify company`,
`Overall status`, `Checked at:`, `Verification checks`,
`Community reports (approved)`, `user-submitted report`,
`Submit report`, `Message analyzer`, `Add message`,
`Analyze conversation`, `Conversation analysis`, `UPFRONT_PAYMENT`,
`Escalation across the conversation`, `Table view (accessible)`,
`Skip to content`, and the help/trends headings.

Changing a heading or a label requires updating the spec in the same change.

## 7. Definition of done for a page

1. Old coffee tokens and rounded-card shells are gone from the file.
2. `Masthead` + `Section` structure, one `<h1>`, no floating card page.
3. Status/band rows use `StatusLabel`/`RiskBand`/`Stamp` (icon + text).
4. All copy in i18n keys, `en` + `hi` written.
5. `npm run lint`, `npm run typecheck`, `npm test` green; no new test skips.
6. Loading / empty / error states all still render (use the primitives).

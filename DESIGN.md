---
name: VERITORA
description: Verify opportunities. Detect deception. Protect job seekers.
colors:
  cover: "rgb(39 64 107)"
  paper: "rgb(246 243 234)"
  stamp: "rgb(192 57 43)"
  tint: "rgb(207 199 180)"
  ash: "rgb(92 86 72)"
  bg: "rgb(246 243 234)"
  surface: "rgb(253 251 245)"
  surface2: "rgb(239 233 220)"
  text: "rgb(31 28 23)"
  heading: "rgb(20 18 15)"
  muted: "rgb(92 86 72)"
  border: "rgb(207 199 180)"
  accent: "rgb(39 64 107)"
  accent2: "rgb(63 98 147)"
  primary: "rgb(39 64 107)"
  action: "rgb(39 64 107)"
  button-bg: "rgb(39 64 107)"
  button-text: "rgb(246 243 234)"
  danger: "rgb(179 38 30)"
  warning: "rgb(138 97 8)"
  success: "rgb(47 107 79)"
  neutral: "rgb(92 86 72)"
typography:
  display:
    fontFamily: "'Libre Baskerville', 'Noto Serif Devanagari', Georgia, serif"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "'Archivo', 'Noto Sans Devanagari', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    lineHeight: 1.65
  label:
    fontFamily: "'Courier Prime', 'Noto Sans Devanagari', ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.16em"
rounded:
  sm: "2px"
  md: "4px"
  lg: "5px"
  xl: "6px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.button-text}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.heading}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
---

# Design System: VERITORA

## Overview

**Creative North Star: "The Dated Stamp"**

VERITORA’s incumbent interface reads as an official case file: paper grounds, an ink-blue file cover for the shell and primary actions, and vermillion reserved for stamps and critical state. The system is documentary and evidentiary rather than promotional — calm, legible, and procedural — because the product must show what was checked, what is known, what is unknown, and what to do next without alarmism or verdict language. Structure carries meaning: mastheads, double rules, dotted entry lines, field labels, and stamped statuses make every screen feel like a filed record in the same set.

**Key Characteristics:**
- **File, not feed:** cover rail, paper surfaces, double rules (`.rule-double`), and dotted entry separators (`.entry`) create a consistent document anatomy.
- **Ink, paper, and a single warning color:** ink-blue (`cover`/`action`) anchors navigation and actions; `paper` is a stable light foreground on the cover in both themes; vermillion (`stamp`) is quarantined to stamps and critical/high-concern state.
- **Stamped evidence:** status and risk are presented as typed/stamped labels (icon + word, never color alone) with mono uppercase treatment and fixed vocabulary.
- **Tabular, plain, accessible:** tabular numerals for data, clear focus rings, reduced-motion support, and bilingual (EN/HI) Devanagari-capable typography.

## Colors

The palette is role-driven and tokenized as CSS custom properties (RGB triplets consumed as `rgb(var(--token) / <alpha-value>)`), with light and dark themes expressing the same file under different lighting.

### Primary
- **File Cover / Ink Blue** (`--color-cover`, `--color-accent`, `--color-action`, light: `39 64 107`, dark cover `29 47 79`): the application rail, primary buttons, active navigation, and key links. It is the system’s structural ink.
- **Paper** (`--color-paper`, light/dark: `246 243 234`): foreground on the cover and primary controls; remains light in both themes to preserve contrast.

### Secondary
- **Accent Lift** (`--color-accent-2`, light: `63 98 147`): hover/secondary emphasis for primary actions and links.
- **Tint / Ash** (`--color-tint`, `--color-ash`): hairline rules, hover fills, dividers, and quiet metadata.

### Tertiary
- **Stamp Vermillion** (`--color-stamp`, light: `192 57 43`, dark: `224 122 99`): used sparingly for stamp impressions and high/very-high concern emphasis — never decorative, never a page-wide alarm.

### Neutral
- **Ground / Surfaces** (`--color-bg`, `--color-surface`, `--color-surface-2`): paper ground, raised file surfaces, and secondary panels (light warm paper; dark “desk lamp” charcoal-brown).
- **Text & Headings** (`--color-text`, `--color-heading`, `--color-muted`): body ink, stronger display ink, and subdued metadata; chosen for WCAG 2 AA contrast per `src/theme/contrast.test.ts`.
- **Border** (`--color-border`): structural lines and control outlines.

**State colors:** `--color-danger`, `--color-warning`, `--color-success` communicate error, caution, and checked states with icon+text labels.

**The One Accent Warning Rule.** Vermillion belongs to stamps and critical state. It must not become a general brand accent or background wash.

## Typography

**Display Font:** Libre Baskerville (with Noto Serif Devanagari, Georgia) — used for page mastheads, section headings, and editorial emphasis.
**Body Font:** Archivo (with Noto Sans Devanagari, system-ui) — the working text of the file.
**Label/Mono Font:** Courier Prime (with Noto Sans Devanagari, ui-monospace) — field labels, stamps, metadata, rail group labels, and tabular/status text.

**Character:** A restrained editorial-meets-bureaucratic pairing: serif authority for headings, clean sans for reading and forms, and typewriter mono for filed metadata.

### Hierarchy
- **Display / Masthead** (`h1`, `text-[1.75rem]`–`2rem` / hero `clamp(2.2rem,4.6vw,3.5rem)`, serif, bold, tight leading): page title and landing hero; closed by a double rule.
- **Section Heading** (`h2`, ~`17px`–`2xl`, serif, bold): passage titles within a file.
- **Body** (`15px`–`17px`, sans, relaxed leading ~1.65, max widths ~58–76ch in key passages): explanatory copy and entries.
- **Label / Meta** (`10px`–`13px`, mono, bold, uppercase, tracked 0.1–0.24em): field labels, rail section labels, counts, and status/stamp text.

**The Filed-Data Rule.** Data, dates, codes, and table figures use tabular numerals (`td, th, .tnum { font-variant-numeric: tabular-nums; }`).

## Layout

- **App shell:** a persistent ink-blue cover rail on large screens (`lg`, fixed-width ~`252px`, sticky, full height) containing brand, grouped navigation, and controls; on narrow screens it collapses to a top bar with a full-screen drawer. Main content sits on the paper ground in a centered column (`max-w-[1240px]`, responsive padding).
- **Page anatomy:** most pages begin with a `Masthead` (title, optional subtitle, optional aside) closed by a double rule, followed by `Section` blocks (serif heading + hairline + entries/content).
- **Rhythm & density:** generous vertical spacing between sections (e.g. `mt-14` on landing), dotted/ruled separation for entries, and readable line lengths for prose.
- **Responsive behavior:** single-column stacks on small screens; multi-column grids appear where appropriate (e.g. landing hero/check grid, path cards). Rail and controls adapt without changing the file identity.

## Elevation & Depth

**The Flat-File Rule.** The system is predominantly flat and print-like: depth is expressed through paper/surface color steps, borders, rules, and occasional restrained shadows rather than heavy layering.

### Shadow Vocabulary
- **`shadow-paper`** (`0 1px 0` border tone + soft diffuse): resting elevation for key paper surfaces (e.g. quick-check panel).
- **`shadow-lift`** (slightly stronger): reserved for emphasized lifted surfaces where defined.

Borders, double rules, and dotted separators do most of the structural work.

## Shapes

- **Corner language:** near-square, utilitarian radii (`2px`–`6px`, `rounded` default `3px`; `full` only where explicitly needed such as scrollbars). Buttons, fields, cards, stamps, and labels favor crisp edges consistent with filed documents.
- **Borders:** 1px ink borders on controls and labels; 2px structural borders for mastheads/shell edges and stamps; dotted bottom borders for entries; double rules (1px/2px gap/1px) to close mastheads and divide major passages.
- **Silhouette:** rectangular blocks and stamped insets; no soft/pill-heavy UI vocabulary.

## Components

### Buttons
- **Shape:** square-ish corners (token radii), 1px border, no shadow, semibold, inline-flex with gap. Base: `inline-flex items-center justify-center gap-2 border font-semibold leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60`.
- **Primary:** ink-blue fill/border (`action`/`button-bg`), paper text (`button-text`), hover to `accent2`. Sizes `sm/md/lg` adjust padding and type (`13px`/`sm`/`15px`).
- **Secondary:** transparent fill, `heading` border/text, hover `tint/40`.
- **Ghost:** borderless/link-like, accent text with underline, used sparingly.
- **Danger:** danger-tinted background with danger border/text.

### Navigation (Rail)
- **Structure:** cover background, paper/heading-contrast text, grouped sections with mono uppercase group labels, item links with hover fill and active state (`bg-paper text-cover`, semibold).
- **Controls:** theme and language selectors and auth actions live in the rail; mobile presents the same content in a drawer with close/menu affordances.

### Masthead
- **Behavior:** page title (serif display) + optional subtitle (muted, constrained width) + optional right-side aside/actions, closed by `.rule-double`.

### Section
- **Behavior:** serif `h2` with optional mono meta and action aligned on a bottom border, followed by content; used to segment the file into headed passages.

### Form Fields
- **Style:** labeled by mono uppercase `field-label`, bordered surface inputs (`fieldClass`: `w-full border border-border bg-surface px-3 py-2`), hover border to tint, muted placeholders, hint and error text styles (`fieldHintClass`, `fieldErrorClass`).
- **Focus:** global `focus-visible` ring (`ring-2 ring-accent ring-offset-2 ring-offset-bg`).

### Stamp
- **Signature component:** mono, uppercase, tracked, 2px bordered block with tone variants (`stamp`/`warning`/`ink`/`muted`) and optional press-in animation (`.stamp-press`, reduced-motion collapsed globally). Carries dated/status impressions; the adjacent text must state the same meaning in words.

### Status Label
- **Behavior:** icon + word, mono uppercase chip-like label with fixed vocabulary (`checked`, `warning`, `inconclusive`, `not_checked`, `under_review`); never color alone.

### Risk Band
- **Behavior:** icon + sentence label for concern bands (`Lower/Moderate/High/Very high concern`, `Insufficient information`), color corroborates but words carry meaning.

### Cards / Containers
- **Style:** paper/surface backgrounds with 1–2px borders, minimal radius, used for quick-check, path links, and informational blocks; hover may shift border/background subtly.

## Do's and Don'ts

### Do:
- **Do** present status and risk as icon + text with the fixed product vocabulary; color is corroborative, never the only signal.
- **Do** keep vermillion (`stamp`) limited to stamp impressions and critical/high-concern state within the evidentiary system.
- **Do** use the masthead + double rule + section/entry anatomy to keep pages reading as one document set.
- **Do** preserve tabular numerals for data, visible focus states, `prefers-reduced-motion` behavior, and bilingual/Devanagari-tolerant layouts.
- **Do** treat external content as untrusted data in UI flows and keep privacy/calm language consistent with PRODUCT.md.

### Don't:
- **Don't** introduce "fake/genuine" verdicts or probability phrasing; show evidence, unknowns, bands, and next steps instead.
- **Don't** turn stamp/vermillion into a decorative accent, background theme, or alarmist treatment.
- **Don't** use pill-heavy, glossy, or feed-like patterns that break the filed-record character (square-ish, ruled, flat-file is the norm).
- **Don't** rely on color alone, remove focus indicators, or add motion that ignores reduced-motion preferences.
- **Don't** promote a single page's composition into a system-wide rule; keep task-local concepts out of the global design system.

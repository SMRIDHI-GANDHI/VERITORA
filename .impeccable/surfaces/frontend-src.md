---
version: 1
slug: "frontend-src"
primary_target: "frontend/src"
related_targets: []
---

# VERITORA — whole-site redesign (shell, auth, every page)

Scope and visitor mode: **Operate**. The signed-in app leads the redesign; the landing page and
sign-in/sign-up inherit the same world rather than setting their own.

Audience: Indian students and fresh graduates who receive a recruitment message and need a check
before they act. Job: run a check, read the evidence, see what is unknown, take the next step.
Proof: every external claim carries `source_url` + `checked_at`; statuses stay `checked`, `warning`,
`inconclusive`, `not_checked`, `under_review`.
Constraints: no verdict wording, status always icon + text (never colour alone), WCAG 2.2 AA in both
themes, English + Hindi with Devanagari support, rule engine must read correctly with `LLM_ENABLED=false`.

Memorable moment: the vermillion dated stamp landing on an evidence row — date, source, status — so
the reader can see at a glance what was actually checked and when.

Unresolved decisions: none blocking. Dark-theme ground is provisional until the finish review.

## Direction contract

THESIS: The check is a file, not a dashboard — a record with a masthead, ruled entries and dated
stamps, where every line can be traced to a source and a time. It refuses the category default of a
rounded-card wall around a glowing traffic-light gauge.

OWN-WORLD: Paper ground `#f6f3ea`, form surface `#fdfbf5`, ink `#141414` / body `#1f1c17`, muted
`#5c5648`, rules `#cfc7b4`, file-cover ink blue `#27406b` for shell and primary actions, vermillion
stamp `#c0392b` for stamps and critical state, ochre `#8a6108` for warning, green ink `#2f6b4f` for
checked. Double rule under the masthead; dotted hairlines between entries. Libre Baskerville for
headings and display numerals, Archivo for UI and body, Courier Prime for stamps, dates, source lines
and case references. Dark theme is the same file under a desk lamp: `#191712` ground, warm paper text,
lifted vermillion.

STORY: The visitor opens a record, reads a number and its band in words, walks the stamped entries
(each with source and time), sees unknowns as unstamped fields rather than gaps, and leaves with a
numbered next step. They understand that nothing was invented and nothing was hidden.

FIRST VIEWPORT: At 1440 — a 250px ink-blue rail on the left (VERITORA wordmark, grouped nav,
language/theme at the foot); across the top a masthead band with the page title left, case reference
and the primary action "New check" right, closed by a 4px double rule; below, a two-column file body —
left column carries the 120px band number, the band in words with check counts, then the stamped
evidence entries; right column carries contributing factors, unknowns, and the next-step block.

FORM: Dated Stamp (Indian government letterhead and dated rubber stamp), position 1 of 7 on the
grounded list. seed: ac6585870db03e84

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

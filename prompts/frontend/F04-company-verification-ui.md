# F04 — Company verification UI (CORE)
Agent: @frontend-dev | Reads: 09, 06 (VerifyCompany*), 03 FR-CV

## Build
- `/verify/company` form (name, website?, email domain?, registration id?).
- Result view: overall status with `StatusLabel`; field-by-field table (matched / mismatched / unknown / not checked) with source link + "checked at" for each check; approved community report summary with moderation labels and neutral wording; explicit note that a company's existence doesn't prove a specific job or recruiter is authorized.
- Allow "Add this to my analysis" handoff to analyzer; partial results (some adapters failed) show reason, not error walls.

## Acceptance
Fixtures for each of the 5 statuses; unknown fields never styled as warnings; every external claim shows source + timestamp; keyboard and screen-reader tests (table headers, aria-live on results); i18n en/hi complete for the page.

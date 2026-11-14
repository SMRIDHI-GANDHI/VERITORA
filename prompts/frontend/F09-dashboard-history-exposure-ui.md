# F09 — Dashboard, history, data exposure checker
Agent: @frontend-dev | Reads: 09, 06, 03 FR-DB

## Build
- Dashboard cards and Recharts charts (analyses over time, risk band distribution) with accessible data tables; recent assessments; saved opportunities; report statuses; checklist progress.
- History list/detail with "refreshed vs original" comparison view showing what changed and when.
- `/exposure`: paste requested items or tick a checklist; results grouped by category with why-it-may-be-unnecessary, safer alternatives, and a prominent warning about passwords/OTPs/banking credentials; explicit "do not upload documents here" note and client-side redaction guidance.

## Acceptance
Charts readable in both themes with non-color encodings; comparison view tests; classification fixtures render correct groupings; no upload control exists on the exposure page.

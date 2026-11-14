# F07 — Recruiter, URL scanner, message analyzer UI
Agent: @frontend-dev | Reads: 09, 06, 03 FR-RV/FR-US

## Build
- `/verify/recruiter` form and result (affiliation evidence + source, mismatches, unknowns, "contact the company via independently sourced channels" guidance).
- URL tab in analyzer: submit URL → show extracted fields in an editable form with extraction confidence; blocked/limited states offer manual paste; clear notice that VeriTrust only reads public pages and respects site rules.
- Message tab: conversation entry (add messages by sender), results highlight escalation points per message.

## Acceptance
Generic email displayed as informational unknown, not warning; blocked URL flow tested; editing extracted fields updates the analysis request; a11y and i18n complete.

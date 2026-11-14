# F05 — Community reports and ratings UI (CORE)
Agent: @frontend-dev | Reads: 09 §5, 06 (Report*, Rating*), 03 FR-CR

## Build
- `/reports`: searchable list of approved reports (ReportPublic) with neutral label "user-submitted report", moderation status badge, rating summary (count, dimension averages, labeled user-submitted experience).
- `/reports/new`: redaction warning first; client-side PII detector (phone/email/12-digit ID/card-like) that warns and offers masking; category select (enum), description, date, optional flags, optional evidence upload with size/type guidance; confirmation screen explaining "pending review, not treated as confirmed fact".
- Author view: "My reports" with status timeline, edit, delete request, appeal.
- Rating form (1–5 + clarity/transparency/consistency).

## Acceptance
Pending reports never appear in public list; PII warning test; copy audit for allegation-vs-fact wording; form accessibility (errors announced); tests for submit → pending → status view with mocked API.

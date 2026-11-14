# B08 — Recruiter verification, URL scanner, message analyzer
Agent: @backend-dev | Reads: 03 FR-RV, FR-US, 06, 08 (SSRF)

## Build
- `POST /verify/recruiter`: compare email domain to independently identified company domains (from B05 results, not only user-supplied); generic providers → `unknown` note only; optional profile URL checked via SafeFetch where public (no login bypass); outputs affiliation evidence, mismatches, unknowns, safe next step.
- `POST /scan/url`: validate → SSRF-safe fetch (reuse `core/ssrf.py`) → extract fields with `selectolax`/`beautifulsoup4` (no JS exec) from JSON-LD `JobPosting` first, then heuristics → return editable extracted fields plus `extraction_confidence`; if blocked/limited return `blocked_reason` and manual-paste fallback instruction. Respect robots.txt guidance; per-domain rate limit; cache.
- `POST /analyze/message`: input is a conversation (list of messages with sender role); detects escalating pressure and delayed payment asks across turns; reuses signal catalog; spans reference message index + offsets.
- Integrate recruiter mismatch as `RECRUITER_AFFILIATION_MISMATCH` evidence only on actual mismatch.

## Acceptance
Full SSRF suite (08 §6) passes against the endpoint; redirect-to-private blocked; oversize/timeouts handled; extraction fixtures for 3 sample HTML pages; message-analyzer demo scenario 2 yields escalation factor with spans; generic-email-only recruiter yields no warning.

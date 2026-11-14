# B05 — Company verification service (CORE)
Agent: @backend-dev | Reads: 03 FR-CV, 04 §4, 05, 06, 08

## Build
- Migration: `verification_checks`; extend `companies`.
- `VerificationSource` interface + adapters: `DomainConsistencyCheck` (claimed website vs email domain vs normalized company name tokens), `LookalikeDomainCheck` (homoglyph/IDN normalization, edit distance against the claimed/known domain, suspicious TLD list from config), `SafeFetchCheck` (uses `core/ssrf.py` safe client to fetch homepage title/redirect target; reuse in B08), `CommunityReportLookup` (approved reports only), `RegistryLookupCheck` (interface + config-gated stub that returns `not_checked` without credentials).
- Orchestrator runs adapters concurrently with per-adapter timeout; any failure → `inconclusive` with `details.error_class`; computes `overall_status` using the 5 allowed statuses; stores `source_url` + `checked_at`.
- `POST /api/v1/verify/company` and `GET /companies/{id}`; integrate results as evidence into B04 risk engine (COMPANY_DOMAIN_MISMATCH factor only on `mismatch`, none on `inconclusive`/`not_checked`).
- Implement `core/ssrf.py` now (full suite per 08) since SafeFetch needs it.

## Acceptance
Response lists matched, mismatched, unknown fields individually. Never returns "verified genuine". Offline/blocked source → `not_checked`/`inconclusive` and risk unaffected. SSRF test suite from 08 passes. Lookalike tests (e.g., `rn` vs `m`, Cyrillic homoglyph) detected. Every external claim has source + timestamp.

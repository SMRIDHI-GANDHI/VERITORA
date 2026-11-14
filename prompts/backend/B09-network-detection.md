# B09 — Recruitment fraud network detection (CORE)
Agent: @backend-dev | Reads: 03 FR-NW, 05, 08

## Build
- Migrations: `network_entities`, `network_relationships`, `network_evidence`; `description_fingerprint` on job_postings; `pgvector` optional behind flag.
- Normalizers + HMAC hashing (`NETWORK_HMAC_KEY` env) for email domain, website domain, phone (E.164), recruiter handle, payment handle. Raw values never stored in entities.
- Text similarity: shingling + MinHash (datasketch or custom) baseline; optional sentence-transformers embeddings if flag on.
- Edge generation on every new analysis/report: shared domain/identifier edges (exact), near-duplicate template edges with similarity score and confidence.
- NetworkX graph builder, connected components, simple spike detection (reports per entity per week above threshold).
- Alerts table/view: only edges involving at least one approved report OR similarity ≥ threshold; mark `review_status=pending`.
- Endpoints: `GET /network/search` (moderator), `GET /admin/network/alerts`; public approved-pattern summaries contain no identifiers.
- Output payload includes `notice: "lead_for_review_not_proof"`.

## Acceptance
Demo scenario 4 (three postings sharing domain/template) produces an alert with evidence and confidence; no raw identifiers in DB or API for non-moderators; graph proximity alone never changes the public label; promotion needs moderator approval (audit logged); unit tests for normalizers, MinHash threshold, spike detection.

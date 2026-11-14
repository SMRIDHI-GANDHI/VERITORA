# B12 — Trust Passport and multilingual explanations
Agent: @backend-dev | Reads: 03 FR-TP, FR-LG, 06, 08

## Build
- `trust_passports` table; `POST /passports` creates snapshot with random 256-bit token (return once; store SHA-256 hash), expiry (default 30 days), `DELETE /passports/{id}` revokes; `GET /passports/{token}` public, excludes personal info, includes checks performed AND not performed, statuses, factors, community summary with moderation labels, recommendation, rules version, disclaimer, expiry/refresh guidance.
- Explanation translation: i18n catalog for fixed templates (en, hi) for recommendations/factor explanations; optional machine translation adapter (disabled by default) with `translation_confidence` flag and original text preserved.
- Add plain-language "explain this wording" endpoint for formal/manipulative clauses (rule-based first).

## Acceptance
Revoked/expired tokens return 404-style response; token hash only in DB; passport contains no user identity; Hindi explanations present for all recommendation codes; translated payloads always include the original text.

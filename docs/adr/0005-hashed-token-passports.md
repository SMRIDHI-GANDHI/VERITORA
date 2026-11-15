# ADR 0005 — Hashed-token Trust Passports
Status: Accepted
Context: FR-P1 (Trust Passport) requires a shareable, revocable, expiring snapshot of a job analysis that exposes no personal data. The public link must be usable without authentication, so the token itself is a bearer secret; storing raw tokens would allow database readers to redeem active passports.

Decision:
- On creation, generate a 256-bit random URL-safe token (`secrets.token_urlsafe(32)`), compute `SHA-256(token)` and store only `public_token_hash`, `snapshot_json`, `analysis_id`, `created_by`, `expires_at`, `revoked_at`, and timestamps in `trust_passports`. The raw token is returned once in the create response and never persisted or logged.
- Public lookup (`GET /passports/{token}`) hashes the presented token and matches on `public_token_hash`; it returns 404 when not found, expired, or revoked (no existence leakage). The response is the stored snapshot plus `passport_id`, `expires_at`, `created_at`, and `revoked` flag.
- Snapshots are built at creation time from `JobAnalysis.result_json` (risk indicator, band, factors, checks performed/not performed, unknowns, recommendations, approved-community summary, disclaimer, `rules_version`, `analysis_created_at`, refresh guidance, `no_personal_data: true`). Snapshots are immutable evidence of what was known at issuance; users refresh by re-analyzing and creating a new passport.
- Ownership is enforced for listing (`GET /passports`, `created_by = user`) and revocation (`DELETE /passports/{id}` sets `revoked_at`, owner-only, idempotent in effect). Default expiry is 30 days (clamped 1–365). Creation/revocation are audit-logged.

Consequences: Token secrecy depends on TLS and client handling; loss of the token means the public link cannot be recovered (by design). Hash-only storage prevents admin/support token recovery and makes rotation/reissue the remedy for suspected leakage. Because snapshots are immutable, later verification changes do not update issued passports; the `refresh_guidance` field makes this explicit to viewers.

Alternatives considered: (1) Store raw tokens — rejected, database compromise would expose all active share links. (2) Signed JWT as the public token — rejected, revocation/expiry would require additional server state and JWT leakage carries the same bearer risk without simpler lookup. (3) Encrypt tokens at rest — rejected as unnecessary complexity when a one-way hash suffices for equality lookup and the plaintext is never needed after issuance.

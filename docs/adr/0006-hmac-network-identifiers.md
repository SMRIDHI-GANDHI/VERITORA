# ADR 0006 — HMAC-protected network identifiers
Status: Accepted
Context: Network/graph features correlate jobs, reports, domains, phones, handles, and payment identifiers to detect repeated patterns (FR-NW). Storing raw contact identifiers would retain PII, expand breach impact, and conflict with minimization/privacy rules in `docs/08-SECURITY-PRIVACY.md` (identifiers HMAC-hashed; no public raw identifiers; graph UI moderator-restricted; "lead not proof").

Decision:
- Normalize identifiers before hashing (email/website domains lowercased and stripped; phones reduced to digits with basic E.164-like normalization; handles/payment handles NFKC-normalized/lowercased) to make equivalent values collide consistently.
- Derive a protected value as `HMAC-SHA256(network_hmac_key, normalized_value)` and store it as `NetworkEntity.protected_value_hash` with `entity_type` and restricted visibility. Raw identifiers, emails, phone numbers, and handles are never persisted in network entities/evidence.
- `NETWORK_HMAC_KEY` is a required secret in non-development environments (validated by `Settings`) so hashes are not reproducible with a known/default key. The key is loaded from env/config only (no hardcoding).
- Relationships/evidence store kinds, similarity/confidence, review status, and record refs (UUIDs/kinds) only; moderator search/alerts expose hashed refs and "lead for review, not proof" notices. Similarity/fingerprints for descriptions use deterministic shingling/MinHash and SHA-256 fingerprints over normalized text, not raw content storage beyond existing posting/report records.
- Network processing is best-effort and must not break core analyze/report flows; failures are contained/rolled back per operation.

Consequences: Hashing is irreversible for lookup by plaintext without the key, so moderator correlation relies on recomputing hashes inside the service boundary when inputs are available. Key rotation would orphan prior hashes (a deliberate tradeoff for privacy); rotation requires a planned re-derivation strategy if historical linkage must survive. Normalization choices affect match quality (false merges/splits possible) and must be changed carefully with migration awareness.

Alternatives considered: (1) Store raw identifiers with access controls — rejected, unnecessary PII retention and higher exfiltration impact. (2) Plain SHA-256 without HMAC — rejected, vulnerable to dictionary/rainbow-table attacks for low-entropy identifiers (phones/domains). (3) Per-record random salts — rejected, prevents equality joins needed for deduplication/correlation. (4) Encryption with searchable index — rejected as more complex than keyed hashing for equality-only matching needs.

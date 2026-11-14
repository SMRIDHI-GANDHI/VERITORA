# B03 — Cyber resources endpoint
Agent: @backend-dev | Reads: 06 ("Cyber resources"), 03 FR-CY

## Build
- `app/config/cyber_resources_in.json` containing exactly the resources in the contract (portal https://cybercrime.gov.in/, helpline 1930, CERT-In site, CERT-In contact page, incident@cert-in.org.in, 1800-11-4949), plus `reviewed_at` and `country`.
- `GET /api/v1/resources/cybercrime` (anonymous, cacheable) loading from `CYBERCRIME_RESOURCES_FILE`; schema validation at startup; fail fast if invalid.
- Include disclaimer key and the "primary" flags: 1930 and the portal are primary; CERT-In is incident response, not a replacement for a police/cybercrime complaint.

## Acceptance
Test asserts exact URLs/numbers; test that swapping the config file changes the response; startup fails on malformed config; response contains no claim that VeriTrust files complaints.

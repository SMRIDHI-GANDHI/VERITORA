# B10 — History, dashboard, data exposure checker, recommendations, watchlist
Agent: @backend-dev | Reads: 03 FR-DB, FR-SR, 05, 06

## Build
- `GET /analyses`, `POST /analyses/{id}/refresh` (new analysis with `supersedes_id`), `GET /dashboard` aggregates, saved opportunities and checklist progress tables/endpoints.
- `POST /data-exposure/check`: input list of requested fields (free text or checklist) → classification (ordinary, contact, identity, financial, credentials, other_sensitive), per-stage necessity explanation, safer alternatives, and hard warning for passwords/OTP/banking credentials. Never accept or store document uploads here.
- Recommendation service consolidated with `recommendations.yaml`, priority ordering, i18n keys.
- Watchlist: tables `watchlist_entries`, `watchlist_appeals`; endpoints under `/admin/watchlist`; transitions per 04 §6; elevated status requires moderator; public API exposes only neutral flags (`additional_verification_recommended`).
- `POST /feedback/analysis/{id}` for false-positive feedback; `/admin/metrics`.

## Acceptance
Refreshed analysis is linked and distinguishable; dashboard counts correct under fixtures; exposure checker classification tests (Aadhaar, PAN, bank account, OTP, resume, phone); watchlist transitions enforced with audit logs; appeals reopen entries; public endpoints never return watchlist labels beyond neutral wording.

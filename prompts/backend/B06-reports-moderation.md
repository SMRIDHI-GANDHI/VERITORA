# B06 — Community reports, ratings, moderation (CORE)
Agent: @backend-dev | Reads: 03 FR-CR, FR-AD, 04 §5, 05, 06, 08

## Build
- Migrations: `community_reports`, `experience_ratings`, `report_evidence`, `moderation_actions`.
- Endpoints per contract: submit/list/edit/delete/appeal reports, ratings, `GET/PATCH /admin/reports`.
- PII scanner service (phone, email, 12-digit ID-like, PAN-like, card Luhn, UPI/IFSC) → `pii_flagged` and `pii_warnings`; public output uses `public_summary` written/approved by moderator; raw description never public.
- Moderation state machine enforcing allowed transitions; every action writes `moderation_actions` + `audit_logs`; private notes never returned to non-moderators.
- Rating abuse controls: unique per user/company/job, velocity limit, near-duplicate text detection (simple shingling), `spam_score`, auto-flag for review.
- Public company summary: counts by moderation status with neutral labels; pending reports contribute zero to risk.
- Evidence upload (images/PDF) with allowlist, size cap, magic-byte check, private storage abstraction (local dev; S3-compatible interface), `redaction_status`.

## Acceptance
New report is `pending_review`; ordinary users never see others' pending/rejected content or private notes; IDOR tests pass; PII never present in public endpoints (test); illegal state transitions rejected; ratings labeled `user_submitted_experience`; XSS payload stored inert; moderator actions appear in audit log.

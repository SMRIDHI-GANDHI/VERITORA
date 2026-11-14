# B02 — Auth, users, RBAC, rate limiting, audit log
Agent: @backend-dev | Reads: 05, 06, 08 | Requirements: FR-AU-*, FR-AD-1, FR-AD-3

## Build
- Endpoints: `/auth/register|login|refresh|logout`, `GET/PATCH/DELETE /me` per contract. Argon2id hashing; JWT access (30 min) + refresh in httpOnly Secure SameSite cookie with rotation.
- `deps.py`: `get_current_user`, `require_role("moderator")`, `require_role("admin")`. Object-level ownership helper returning 404 for foreign objects.
- Rate limiting on auth routes (e.g., 5/min/IP for login) with generic error messages (no user enumeration).
- `AuditLogger` service writing append-only `audit_logs` (actor, action, resource, request_id, ip_hash). Log role changes, account deletion.
- Admin seed command `python -m app.scripts.create_admin`.
- Alembic migration extends `users` (language, theme, role enum, is_active).

## Acceptance
Authz matrix test for every route (anon/user/moderator/admin). Password never logged or returned. Refresh rotation invalidates reused token. Rate-limit test passes. `DELETE /me` anonymizes user and keeps audit actor id.

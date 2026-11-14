# ADR 0004 — Auth error UX, duplicate registration and rate-limit responses

Status: Accepted

Context:

Sign-up failures surfaced as a single unhelpful message ("Sign up failed. Please
try again.") because `SignUp.tsx` discarded the `HttpError` it received. The
three real causes were indistinguishable to the user:

- an existing account (backend returned `400 {"detail": "Registration failed"}`),
- the register rate limit (5/minute per client),
- the backend being unreachable or CORS-blocked.

Separately, rate-limit rejections used slowapi's default `{"error": "..."}` body,
which does not match the documented problem-JSON error contract, and the default
CORS allow-list was the single origin `http://localhost:5173`.

Decision:

1. Clients surface the true cause. `frontend/src/lib/authErrors.ts` maps HTTP
   status to actionable copy (400/409 duplicate, 422 validation, 429 rate limit,
   5xx server, non-HTTP network failure). `SignUp` and `SignIn` both use it.
2. Duplicate registration is stated plainly. The endpoint keeps status `400`
   (no status-code change) but returns `detail` telling the user the account
   exists and to sign in. The earlier generic message was an anti-enumeration
   measure; it is dropped for registration because the user cannot proceed
   otherwise. Login stays generic (`401 Invalid credentials`) so it still does
   not reveal whether an account exists.
3. Rate-limit responses use problem JSON (`status:429`,
   `code:"RATE_LIMITED"`, `request_id`) plus a `Retry-After` header.
4. `/auth/register` allows `10/minute`; `/auth/login` and `/auth/refresh` stay at
   `5/minute` (brute-force protection matters more there).
5. Outside `APP_ENV=production` the API accepts any
   `http://localhost:<port>` / `http://127.0.0.1:<port>` origin in addition to
   the explicit list, because Vite shifts ports and browsers treat `localhost`
   and `127.0.0.1` as different origins. Production ignores the regex and uses
   only `CORS_ORIGINS`.

Consequences:

- Sign-up errors are now actionable instead of opaque.
- Registration reveals that an email is already registered. This matches common
  practice and is limited to registration; login and password reset remain
  generic.
- 429 responses conform to the API contract and clients can back off using
  `Retry-After`.
- Development on any loopback port works; deployed environments keep the strict
  explicit allow-list.

Alternatives considered:

- Keep the generic 400 and infer "duplicate" in the client: still leaks the same
  information through behaviour while giving worse copy.
- Use `409 Conflict` for duplicates: semantically clean, but a status-code
  change with no user-visible benefit, so it was left at `400`.
- Allow `*` for CORS in development: incompatible with credentialed requests and
  too broad; a loopback regex is narrower.

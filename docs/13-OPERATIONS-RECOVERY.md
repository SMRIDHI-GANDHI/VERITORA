# 13 — Operations: Production Configuration, Backup/Restore & Migration Rollback

Status: **Operational runbook (policy and procedures)**. Items marked **Tested** have been exercised in this repository's automated checks or are directly evidenced by current implementation/configuration. Items marked **Proposed / requires isolated environment verification** must be validated in a staging/isolated environment before being relied on for production recovery.

Scope: Phase G Tasks 1–2 (production configuration review findings and database recovery/migration policy). This document does not authorize destructive actions on live/user databases.

## 1. Production configuration review (Task 1)

### 1.1 Secrets and sensitive configuration

| Area | Current implementation (evidence) | Assessment | Required action |
|---|---|---|---|
| `SECRET_KEY`, `NETWORK_HMAC_KEY`, `DATABASE_URL` loading/validation | `backend/app/config.py`: `pydantic-settings` loads from env (`.env` in working dir, usually `backend/`), `extra="ignore"`. `SECRET_KEY` has `min_length=16`. Runtime validation rejects empty/placeholder `SECRET_KEY` and `NETWORK_HMAC_KEY` when `APP_ENV` is not in `{development,dev,test,local}`. Outside dev-like envs, `DATABASE_URL` must be explicitly supplied and must not be the built-in development default; startup fails with a generic error that does not include the URL or credentials. `LLM_API_KEY`/`SEARCH_API_KEY` default empty and are optional. | **OK (required controls present).** Non-dev envs fail fast on insecure secret defaults/placeholders and on missing/default development database configuration. | Set strong random secret values and an explicit `DATABASE_URL` in production/staging/non-dev secrets manager/env. Use explicit dev-like `APP_ENV` names only for development/test/local workflows. |
| Secret exposure in logs/errors/responses/frontend | `backend/app/core/logging.py`: JSON logs with timestamp/level/logger/message/request_id and exception formatting only; no request/response bodies or settings logged. `backend/app/core/errors.py`: problem JSON (`type/title/status/detail/code/request_id`) with generic messages for validation/unhandled errors. `backend/app/services/audit.py`: stores hashed IP/request metadata/actions, not secrets. `backend/app/services/llm.py`: avoids logging API key/headers/URLs with secrets; returns generic failure messages. Frontend uses only `VITE_API_BASE_URL` (`frontend/src/lib/api.ts`); Vite exposes `VITE_*` vars by design. | **OK based on code review (tested by existing behavior/tests patterns, not a penetration test).** No evidence of intentional secret emission. | Keep secrets only in env/secret store, never in `VITE_*` vars, never in API responses. Continue log review in production monitoring. |
| `.env` handling | `.env.example` / `backend/.env.example` provide placeholders; `.gitignore` excludes env files (repo practice). | **OK (documentation/config hygiene).** | Never print/copy/commit real `.env` values. |

**Severity summary (secrets/config):** required startup validation for JWT/HMAC secrets and explicit non-default `DATABASE_URL` outside dev-like environments is implemented (**no blocking gap found in these controls**). Operators must still supply correct per-environment secret values/URLs.

### 1.2 Cookie security (refresh/auth)

| Area | Current implementation (evidence) | Assessment |
|---|---|---|
| Cookie attributes | `backend/app/api/routes/auth.py`: refresh cookie `HttpOnly=True`, `SameSite="strict"`, `Path=/api/v1/auth`, `Max-Age=14 days`, set/cleared consistently. | **OK.** Matches `docs/08-SECURITY-PRIVACY.md` intent (httpOnly + Secure + SameSite; SameSite Strict + defense-in-depth). |
| `Secure` attribute | `_cookie_secure()` returns `True` when `APP_ENV` is not in `{development,dev,test,local}`; `False` only for explicit dev-like envs to allow local HTTP. | **OK with operational note.** Non-dev envs (including staging and production/prod) get `Secure` cookies (HTTPS required). Deployments must terminate TLS correctly and set `APP_ENV` appropriately. |
| Refresh/logout behavior | Refresh rotates token, detects reuse and revokes family, clears cookie on invalid/reused/expired cases. Logout revokes family tokens (best effort) and clears cookie. | **OK.** Rotation/reuse detection and logout invalidation are implemented. |
| CSRF defense-in-depth | `POST /auth/refresh` and `POST /auth/logout` require `_require_csrf`: accepts `X-Requested-With` header or trusted Origin/Referer; if neither Origin nor Referer is present, request is allowed (non-browser/legacy compatibility); untrusted browser origin/referer returns 403. Trusted localhost origins for CSRF shortcut allowed only in dev-like envs (aligned with CORS fix). | **OK (defense-in-depth).** Primary protection remains SameSite=Strict cookie + token handling; CSRF checks add protection for browser contexts. |
| Dev/test separation | Dev-like envs (`development,dev,test,local`) allow non-Secure cookies for HTTP local workflows and localhost convenience where explicitly implemented. | **OK if env is set correctly.** |

**Severity summary (cookies):** **no blocking gap found** in implementation. **Operational requirement:** HTTPS for all non-dev envs; `APP_ENV` must accurately reflect environment class.

### 1.3 CORS allowlist

| Area | Current implementation (evidence) | Assessment |
|---|---|---|
| Allowed origins | `backend/app/main.py`: `CORSMiddleware` uses `allow_origins=settings.cors_origins_list` from `CORS_ORIGINS` env (comma-separated), `allow_credentials=True`. No wildcard origin value is generated by code. | **OK for allowlist source.** Production origins must be explicitly configured via env. |
| Localhost convenience | `backend/app/config.py` `cors_origin_regex`: allows any `http://localhost:<port>` / `http://127.0.0.1:<port>` **only** when `APP_ENV` is in `{development,dev,test,local}`; returns `None` for staging/production/other envs. Auth CSRF localhost shortcut aligned to same dev-like env set. | **Fixed in this phase (medium).** Previously non-production env names outside dev-like set (e.g. staging) could accept localhost regex origins; now restricted to explicit dev-like envs. |
| Methods/headers | `allow_methods=["*"]`, `allow_headers=["*"]` with credentials enabled. | **Low-risk gap / recommendation.** Broader than necessary but common for SPA APIs; not a wildcard-origin issue. Consider tightening to required methods/headers in a future reviewed change if deployment policy requires. |
| Frontend/deployment consistency | Frontend defaults API base to `http://localhost:8000/api/v1` and uses `credentials: 'include'` (`frontend/src/lib/api.ts`); E2E/CI set explicit origins and API URLs. | **Operational.** Production frontend origin(s) must be included in `CORS_ORIGINS`; `VITE_API_BASE_URL` must point to the deployed API base URL. |

**Severity summary (CORS):** localhost-regex hardening applied (**medium** gap addressed). Remaining method/header breadth is **low**.

### 1.4 APP_ENV behavior

| Area | Current implementation (evidence) | Assessment |
|---|---|---|
| Recognized dev-like envs | `DEV_ENVS = {development,dev,test,local}` used for dev-only runtime conveniences: local dev secret/default-database allowances, localhost CORS regex, localhost CSRF shortcut, and non-Secure cookies. | **OK but sensitive to naming.** Unknown env names (e.g. `staging`) are treated as non-dev: secrets/DB URL must be explicitly configured, cookies are Secure, and localhost regex/shortcuts are disabled. |
| Production detection / HSTS | `backend/app/core/logging.py` sets `Strict-Transport-Security` **only** when `APP_ENV` is `production` or `prod` **and** the request is HTTPS (`request.url.scheme == "https"` or `X-Forwarded-Proto: https`). Other security-sensitive behavior (secret/DB validation, Secure cookies, localhost CORS/CSRF restrictions) is driven by the dev-like set, not by the production-name check. | **Intentional, documented behavior (kept unchanged).** Use `APP_ENV=production` (or `prod`) for production HTTPS deployments that must emit HSTS. Non-dev envs with other names (e.g. staging) still receive strict secret/DB/cookie/CORS handling but will not emit HSTS unless named `production`/`prod`; this avoids broadening HSTS behavior without deployment compatibility review. |
| Unsafe fallbacks | Defaults exist only for local dev-like workflows; non-dev envs fail startup on placeholder JWT/HMAC secrets and on missing/default development `DATABASE_URL`. `docker-compose.yml` is a local/dev-oriented example (includes sample DB credentials and env_file usage). | **Operational caution.** Do not use compose example values in production; production must use managed secrets/env, explicit `DATABASE_URL`, and correct `APP_ENV`. |

### 1.5 Task 1 conclusion

- **Clearly required documented security controls present:** env-only secrets/config, non-dev placeholder secret rejection for `SECRET_KEY`/`NETWORK_HMAC_KEY`, explicit non-default `DATABASE_URL` required outside dev-like envs, refresh cookie `HttpOnly` + `Secure` (non-dev) + `SameSite=Strict`, CSRF defense-in-depth on cookie-auth refresh/logout, CORS allowlist from env, HSTS for `production`/`prod` HTTPS requests, generic problem JSON errors, JSON logging without designed secret fields.
- **Fixes implemented in this phase (minimal/safe):** restricted localhost CORS regex and auth localhost-origin CSRF shortcut to explicit dev-like envs (`development,dev,test,local`) to prevent unintended localhost acceptance in staging/other non-dev env names; required explicit non-default `DATABASE_URL` outside dev-like envs with safe startup failure; updated CORS comment; clarified HSTS `APP_ENV` behavior in this runbook (no HSTS behavior change).
- **Residual gaps (not changed without broader approval):** permissive CORS methods/headers (**low**), production-name-specific HSTS while other controls key off dev-like set (**low/documentation**, intentional pending deployment compatibility review).

## 2. PostgreSQL backup, restore, and migration rollback policy (Task 2)

### 2.1 Current database and deployment context (inspected)

- Backend DB: PostgreSQL via SQLAlchemy async engine (`asyncpg`) and Alembic migrations (`backend/alembic/`, versions `0001`–`0009`, all define `upgrade` and `downgrade`).
- Local/dev example: `docker-compose.yml` provides `postgres:16` service and `backend/Dockerfile` runs `uvicorn`; compose includes example credentials for local use only.
- CI: PostgreSQL 16 service containers used for isolated integration/e2e jobs with migrations applied to disposable databases.
- No in-repo automated production backup scheduler/restore automation was found; backup execution is deployment-platform/DBA responsibility. Procedures below are **standard PostgreSQL practices aligned to this project**; execution against a real environment is **proposed until verified in an isolated environment matching deployment topology**.

### 2.2 Backup policy (PostgreSQL)

**Objectives:** recover from accidental data loss, failed deployment/migration, or infrastructure failure; preserve auditability; protect sensitive data in backups.

| Item | Policy |
|---|---|
| Backup method | Use PostgreSQL logical backups as baseline: `pg_dump` (custom format recommended) for routine backups; `pg_dumpall --globals-only` when roles/tablespaces matter. For managed PostgreSQL, prefer provider-native snapshots/PITR in addition to logical exports where available. |
| Scope | Primary application database (all schemas/tables including Alembic-managed schema, user data, audit logs, moderation data, passports/chat/report records as applicable). Include migration state (`alembic_version`). Store backup metadata: timestamp (UTC), DB name/instance identifier (non-secret), Alembic revision (`alembic current` output captured separately), app/commit version, and checksum. |
| Frequency (recommended) | **Production:** at least daily logical backup + managed continuous WAL/PITR if supported; before every production migration/deployment window take an on-demand pre-migration backup. **Staging:** daily or before risky changes. **Dev/local:** as needed (disposable). |
| Retention (recommended baseline) | **Production:** daily backups 30 days, weekly backups 12 weeks, monthly backups 6–12 months (adjust to legal/compliance/incident needs). **Pre-migration backups:** retain until post-migration verification and rollback window closes (minimum 7–14 days). Align user-data retention/deletion obligations in product/privacy docs. |
| Storage and protection | Store backups in access-controlled, encrypted storage (at rest and in transit). Restrict access to authorized operators/service principals only. Backups contain sensitive/personal data and must be treated as production data (no public buckets, no sharing in tickets/chat). Separate backup credentials/keys from app runtime secrets. |
| Verification | Every backup job must record success/failure and artifact checksum/size. Perform periodic restore tests to an **isolated non-production** database (at least monthly recommended, and after major schema/process changes). Verify backup readability (`pg_restore --list` for custom format) as a lightweight check. |
| Pre-change requirement | Before risky migrations, data backfills, bulk moderation/network operations, or restore drills: ensure a recent verified backup exists and identify the exact restore target and operator. |

#### Practical backup commands (operator examples; run in a secure shell/environment)

> Replace placeholders locally. Do not echo secrets. Prefer `.pgpass`, secret-mounted env vars, or managed identity/auth supported by your platform. Run against the intended environment/database only.

```bash
# Verify connectivity and current migration revision (from backend/, with env configured)
cd backend
alembic current

# Logical backup (custom format, recommended for selective/parallel restore)
# Requires pg_dump client compatible with server major version.
pg_dump --format=custom --file "veritora_<env>_<yyyyMMddTHHmmssZ>.dump" --no-owner --no-privileges "$DATABASE_URL_FOR_PG_TOOLS"

# If DATABASE_URL is SQLAlchemy async form (postgresql+asyncpg://...), convert to libpq/psql form for pg tools:
# postgresql://<user>:<password>@<host>:<port>/<db_name>

# Optional globals (roles) when self-managed and required for full recreation
pg_dumpall --globals-only --file "veritora_<env>_globals_<yyyyMMddTHHmmssZ>.sql"

# Integrity/list check (no restore performed)
pg_restore --list "veritora_<env>_<yyyyMMddTHHmmssZ>.dump" > /dev/null
```

**Docker Compose local/dev example (disposable DB only):** `docker compose exec -T db pg_dump -U <db_user> -d <db_name> -Fc > backup.dump` (use only with non-production local data). **Do not run against live/production user databases from this runbook without approved change control.**

**Status:** commands are **proposed/standard** for PostgreSQL; not executed as a production backup in this phase.

### 2.3 Restore procedure (safe, administrator-run)

**Principles:** never overwrite live production data in-place without approved incident/change process; restore to an isolated target first whenever possible; validate before cutover.

#### A. Prepare
1. **Stop writes / isolate impact:** pause app traffic, background jobs, and migration tasks targeting the affected database (maintenance mode or traffic drain as per deployment platform). Prevent dual-writes.
2. **Select backup artifact:** choose the correct backup file/snapshot and record its timestamp, checksum, Alembic revision metadata, and source environment.
3. **Provision restore target:** create an isolated PostgreSQL database/instance (same major version preferred) with sufficient storage and restricted access. Do **not** point production traffic to it yet.
4. **Protect secrets:** use dedicated restore credentials; do not expose `DATABASE_URL` or passwords in logs/tickets.

#### B. Restore (logical backup example)

```bash
# Create empty target database using approved DBA/platform procedure, then:
# Custom-format restore
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TARGET_DATABASE_URL_FOR_PG_TOOLS" "veritora_<env>_<timestamp>.dump"

# If restoring into a brand-new empty DB, --clean --if-exists may be omitted.
# For plain SQL dumps: psql "$TARGET_DATABASE_URL_FOR_PG_TOOLS" -f backup.sql
```

For managed snapshots/PITR, follow the provider's restore workflow to a new instance/point-in-time target, then apply verification below.

#### C. Post-restore verification (required before cutover/use)

Run in isolated restored environment:

1. **Database integrity/connectivity:** application can connect; basic queries succeed.
2. **Migration state:** from `backend/` with `DATABASE_URL` pointing to restored DB (isolated), run `alembic current` and confirm expected head/revision for the backup's application version.
3. **Schema/application smoke checks:** `GET /healthz` or equivalent liveness and `GET /readyz` (DB readiness) succeed against an app instance configured **only** for the isolated restored DB.
4. **Data sanity checks (minimum):** row counts or spot checks for critical tables (users, job_analyses, community_reports, audit_logs, trust_passports, chat tables as applicable), recent records around backup time, and absence of obvious corruption/errors in app logs.
5. **Security checks:** restored environment uses non-production secrets/endpoints where applicable; no public exposure of restored sensitive data.
6. **Document outcome:** record backup ID, restore target, Alembic revision, verification results, operator, and timestamps.

#### D. Cutover / rollback decision
- Promote restored database only through approved deployment/change procedure after verification passes.
- If verification fails, do not cut over; investigate artifact compatibility (Postgres version/extensions), migration revision mismatch, or incomplete backup scope.

**Status:** procedure is **proposed/recommended** and must be **validated in an isolated environment** (matching Postgres version/extensions and deployment auth model) before production reliance. **No restore performed against live database in this phase.**

### 2.4 Alembic migration rollback policy

#### Current state (evidence)
- Migrations: `backend/alembic/versions/0001`–`0009` each implement `upgrade()` and `downgrade()`; `alembic/env.py` resolves DB URL from app settings.
- Standard commands (from `backend/`, with correct `DATABASE_URL`):
  - Apply: `alembic upgrade head`
  - Inspect: `alembic current`, `alembic history`
  - Downgrade (when safe/approved): `alembic downgrade -1` or `alembic downgrade <revision>`

#### Policy
1. **Pre-migration safety (required):**
   - Take/confirm a verified backup (and snapshot/PITR availability where supported) before risky production migrations.
   - Review migration SQL/operations for lock risk, data rewrites, long-running index builds, enum/type changes, and irreversibility.
   - Run migration in staging/isolated environment on production-like data shape first when feasible.
   - Schedule maintenance window for potentially disruptive migrations.

2. **If a migration fails:**
   - **Stop** further deploy/migration steps; preserve logs, error output, `alembic current`, and DB state evidence.
   - Determine transaction/state: if Alembic/DB rolled back the failed transaction, schema may remain at prior revision; if partially applied (non-transactional DDL/data steps), treat as incident and assess manually.
   - **Do not guess.** Inspect actual schema/data and migration code before taking corrective action.

3. **When Alembic `downgrade` is appropriate:**
   - A tested, reversible `downgrade()` exists for the specific revision(s).
   - No irreversible data transformation/destructive data loss has occurred (or data loss is understood and accepted with backup-backed recovery plan).
   - Downgrade has been validated in an isolated/staging environment for that migration path.
   - Dependencies/constraints allow safe reversal.

4. **When a forward-fix migration is safer (preferred in many production cases):**
   - Downgrade drops data/tables/constraints or cannot restore transformed data.
   - Failure occurred after partial/non-atomic effects or manual intervention.
   - Production has received writes after migration attempt and rollback would lose/corrupt newer data.
   - Hotfix can be applied as an additive/corrective migration with lower risk than reversal.

5. **Database restore vs migration rollback:**
   - Use **restore to isolated target** (or provider PITR) when schema/data integrity is uncertain, data loss occurred, or migration state cannot be confidently repaired.
   - Use **downgrade/forward-fix** only when impact is understood and verified. Restore decisions require approved change/incident process.

6. **Prohibited/unsafe assumptions:**
   - Do **not** assume every migration is safely reversible in production even if `downgrade()` exists (data semantics may differ).
   - Do **not** run downgrade/restore experiments on live production databases without approval and backups.

**Status:** policy is **defined and partially evidenced** (downgrade functions exist in current migrations; command patterns documented). Actual downgrade/restore behavior remains **proposed until tested in an isolated environment** for the specific migration and dataset.

### 2.5 Operational runbook (responsibilities and cautions)

| Topic | Guidance |
|---|---|
| Responsibilities | **DBA/Platform owner:** backup jobs, storage/retention, snapshot/PITR, access controls. **Release operator:** pre-migration backup confirmation, migration execution, verification. **On-call/incident lead:** restore decision, communication, approval for cutover/destructive actions. **Developers:** reversible-safe migration design, downgrade/forward-fix notes in PR/task when relevant. |
| Prerequisites | Authorized access to target environment, PostgreSQL client tools compatible with server, secure secret handling, isolated restore target, maintenance window/traffic control, current `alembic`/app revision metadata. |
| Verification checklist | Backup artifact integrity, restore completes without errors, `alembic current` correct, `/readyz` healthy on isolated app instance, smoke/data sanity checks pass, security posture preserved. |
| Cautions | Backups contain sensitive data; encrypt and restrict. Never expose credentials/`DATABASE_URL` secrets. Never run restore/drop/truncate/delete/reset against live/user databases during routine validation. Test restores only in isolated environments. Record all actions and outcomes. |
| Tested vs proposed | **Tested/evidenced:** existing secret validation behavior, cookie/CORS/HSTS implementation details, Alembic migration files include downgrades (0001–0009), CI migrates isolated ephemeral DBs. **Proposed/requires isolated verification:** production backup scheduling/automation, restore execution, PITR/provider-specific flows, and downgrade/forward-fix outcomes on real production-like datasets. |

## 3. References

- `backend/app/config.py`, `backend/app/main.py`, `backend/app/api/routes/auth.py`, `backend/app/core/logging.py`, `backend/app/core/errors.py`
- `backend/alembic/env.py`, `backend/alembic/versions/0001_*.py`–`0009_*.py`
- `.github/workflows/ci.yml`, `docker-compose.yml`, `backend/.env.example`, `.env.example`
- `docs/02-TRD.md`, `docs/05-DATABASE.md`, `docs/08-SECURITY-PRIVACY.md`, `docs/06-API-CONTRACT.md`

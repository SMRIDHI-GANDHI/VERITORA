# VERITORA (VeriTrust)

AI-assisted recruitment trust and job-fraud detection platform (India-first, configurable). VERITORA provides **decision support only** — it never labels a job or recruiter "fake" or "genuine". Outputs are a risk indicator (0–100, or `null` when insufficient), risk band, contributing factors, evidence, explicit unknowns/missing information, and recommended next steps.

## Project overview and architecture

- **Frontend (`frontend/`)**: React 18 + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + i18next. Calls backend API via `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`).
- **Backend (`backend/`)**: Python/FastAPI + SQLAlchemy 2 (async) + Alembic + Pydantic v2. Layered design (routers → services/repositories/DB models) with deterministic rule-based analysis and optional external verification/LLM integrations behind interfaces/config.
- **Database**: PostgreSQL (async driver `asyncpg`; `DATABASE_URL` must use `postgresql+asyncpg://`).
- **Storage/config**: Private offer-letter storage with TTL/size controls; official cybercrime resources served from config (`CYBERCRIME_RESOURCES_FILE`).
- **CI (`.github/workflows/ci.yml`)**: backend checks, PostgreSQL-backed backend integration tests, frontend checks/build, and Playwright + axe e2e job.

Key product/security rules: missing/unavailable verification data is `unknown`/`inconclusive`/`not_checked` (never fabricated); reports are user allegations until moderated; external content is untrusted data (not instructions); rule engine/chat degraded mode must work with `LLM_ENABLED=false`.

## Prerequisites and supported versions

Verified from project config/scripts:

- **Python**: 3.12+ (`backend/pyproject.toml` requires `>=3.12`; CI uses Python 3.12)
- **Node.js/npm**: Node 20 in CI; local Node 18+ with npm is recommended for frontend tooling (Vite/TypeScript/Playwright)
- **PostgreSQL**: 14+ supported in general; project/docs reference PostgreSQL 18 local development and CI uses PostgreSQL 16 service containers
- **Browser automation (Playwright)**: Chromium (install via Playwright)

## Backend setup

Run backend commands from `backend/` (backend settings load `.env` from the current working directory).

```bash
cd backend
python -m pip install --upgrade pip
pip install -e ".[dev]"
cp .env.example .env
# Edit backend/.env with local placeholders/values (never commit secrets)
```

## Frontend setup

```bash
cd frontend
npm ci || npm install
```

- App dev server: `npm run dev` (Vite, default `http://localhost:5173`)
- Production build preview: `npm run preview`

## Environment configuration

### Files and precedence

- **Root `.env.example`**: reference template for backend and frontend variables/placeholders (documentation aid).
- **Backend `.env.example` / `backend/.env`**: backend runtime configuration. Copy `backend/.env.example` to `backend/.env` and set local values before running backend commands from `backend/`.
- **Frontend**: Vite exposes `VITE_*` variables. Set `VITE_API_BASE_URL` in `frontend/.env` or the frontend process environment if you need a non-default API base URL.
- **Do not read, print, or commit real `.env` secrets/credentials.**

### Supported backend variables (from `backend/app/config.py`)

| Variable | Purpose / notes |
|---|---|
| `APP_ENV` | Environment mode. `development`/`dev`/`local`/`test` allow dev-friendly secret validation; `production`/`prod` require strong non-placeholder `SECRET_KEY` and `NETWORK_HMAC_KEY`. |
| `DATABASE_URL` | **Required** PostgreSQL async URL using `postgresql+asyncpg://` (asyncpg). |
| `SECRET_KEY` | JWT/signing secret (>=16 chars; must be strong/non-placeholder outside dev/test/local/development). |
| `ACCESS_TOKEN_TTL_MINUTES` | Access token lifetime in minutes. |
| `CORS_ORIGINS` | Comma-separated allowed origins. Outside `production`/`prod`, API also allows `http://localhost:<port>` and `http://127.0.0.1:<port>`. |
| `RATE_LIMIT_DEFAULT` | Default rate limit (slowapi format, e.g. `60/minute`). |
| `LLM_ENABLED` | Optional LLM toggle (default `false`); rule engine and degraded chatbot must work when disabled. |
| `LLM_PROVIDER` | Optional LLM provider identifier. |
| `LLM_MODEL` | Optional LLM model name. |
| `LLM_API_KEY` | Optional LLM API key (secret; never commit). |
| `SEARCH_API_KEY` | Optional verification/search key (secret; unavailable/missing sources must not be fabricated). |
| `CYBERCRIME_RESOURCES_FILE` | Path to cybercrime resources config served by API (review before release). |
| `NETWORK_HMAC_KEY` | HMAC key for protected network identifiers (must be strong/non-placeholder outside dev/test/local/development). |
| `OFFER_STORAGE_DIR` | Private offer-letter storage directory. |
| `OFFER_FILE_TTL_HOURS` | Offer-letter retention/cleanup TTL (hours). |
| `OFFER_MAX_UPLOAD_MB` | Offer-letter upload size limit (MB). |

### Supported frontend variables

| Variable | Purpose / notes |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL including `/api/v1`. Default in app: `http://localhost:8000/api/v1`. |

### Playwright/E2E environment variables (optional overrides)

- `E2E_API_URL`: API base URL for Playwright global setup/login (default `http://localhost:8000/api/v1`).
- `E2E_DEMO_PASSWORD`: demo password override for seeded e2e users (default matches seed demo password).

## PostgreSQL setup and connection configuration

1. Create a PostgreSQL role/database for local development (replace placeholders locally; do not commit credentials):

```sql
CREATE ROLE <db_user> LOGIN PASSWORD '<db_password>';
CREATE DATABASE <db_name> OWNER <db_user>;
```

2. Set `DATABASE_URL` in `backend/.env` using the async driver:

```text
postgresql+asyncpg://<db_user>:<db_password>@localhost:5432/<db_name>
```

3. For tests/CI-like isolated runs, use a separate database name (e.g. `<test_db_name>`) and keep credentials out of source control.

**Docker Compose (optional local infra):** `docker-compose.yml` defines `db` (Postgres 16) and `api` services. If using Compose, provide required env values securely and ensure `DATABASE_URL` remains `postgresql+asyncpg://`.

## Alembic migrations

Run from `backend/` with `DATABASE_URL` configured:

```bash
cd backend
alembic upgrade head
alembic current
```

- Applies migrations in `backend/alembic/versions/` to the configured database.
- CI PostgreSQL integration/e2e jobs migrate isolated databases before tests.

## Demo data seeding

Run from `backend/` after migrations (idempotent, synthetic demo data):

```bash
cd backend
python -m app.scripts.seed_demo
```

Seeded demo accounts:

| Email | Role | Password |
|---|---|---|
| `demo-user@veritora.example.com` | user | `DemoPass123!` |
| `demo-mod@veritora.example.com` | moderator | `DemoPass123!` |

Create or promote an admin (run from `backend/`, prompts for password unless `--password` is provided):

```bash
cd backend
python -m app.scripts.create_admin --email you@example.com
```

## Running backend and frontend locally

### Backend

```bash
cd backend
alembic upgrade head
python -m app.scripts.seed_demo   # optional
uvicorn app.main:app --reload --port 8000
```

- API: `http://localhost:8000` (prefix `/api/v1`)
- Liveness: `GET /healthz` (alias `GET /health`)
- Readiness: `GET /readyz` (returns 503 when database is unavailable)

### Frontend

```bash
cd frontend
npm run dev
```

- App: `http://localhost:5173`
- Configure API target with `VITE_API_BASE_URL` if needed.

## Backend tests, Ruff, and mypy commands

Run from `backend/`:

```bash
# Lint
ruff check .

# Typecheck
mypy app

# Unit/integration tests (default local suite; excludes PostgreSQL-backed integration_db folder like CI backend job)
pytest -q --ignore=tests/integration_db

# Full pytest run (integration_db tests require PostgreSQL DATABASE_URL; locally they may skip when not configured)
pytest -q

# PostgreSQL-backed integration tests only (requires migrated PostgreSQL DATABASE_URL; CI enforces fail-fast/no-skip behavior)
pytest -q tests/integration_db
```

## Frontend lint, typecheck, unit tests, and production build commands

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Additional frontend scripts:

```bash
npm run test:watch
npm run preview
```

## Playwright + axe E2E test instructions

Playwright config (`frontend/playwright.config.ts`) starts backend (`uvicorn`) and frontend dev server if not already running (reuses existing servers outside CI). E2E tests and axe checks run via `frontend/e2e/*`.

### Local prerequisites

1. PostgreSQL available and `backend/.env` `DATABASE_URL` configured (`postgresql+asyncpg://...`).
2. Migrate and seed the database used by the backend:

```bash
cd backend
alembic upgrade head
python -m app.scripts.seed_demo
```

3. Install frontend dependencies and Playwright Chromium browser (first time/local CI parity):

```bash
cd frontend
npm ci || npm install
npx playwright install --with-deps chromium
```

### Run E2E + axe tests

```bash
cd frontend
npm run test:e2e
```

Notes:
- Global setup logs in seeded demo user/moderator accounts using `E2E_API_URL` (default `http://localhost:8000/api/v1`) and demo credentials.
- If backend/frontend servers are already running on expected ports, Playwright may reuse them locally.
- Do not run destructive database operations; use an isolated/migrated database for E2E.

## CI workflow overview

Defined in `.github/workflows/ci.yml` (runs on `push` and `pull_request`):

- **`backend`** (Ubuntu, Python 3.12): install dev deps, `ruff check .`, `mypy app`, `pytest -q --ignore=tests/integration_db`, `pip-audit || true`.
- **`backend-integration-db (postgresql)`** (Ubuntu, Python 3.12, Postgres 16 service): configure isolated test DB env vars, install deps, `alembic upgrade head`, run `pytest -q tests/integration_db` with JUnit checks enforcing expected executed tests and zero failures/errors/skips, then `alembic current`.
- **`frontend`** (Ubuntu, Node 20): install deps, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
- **`frontend-e2e (playwright + axe)`** (Ubuntu, Node 20 + Python 3.12, Postgres 16 service): install backend/frontend deps, migrate+seed isolated e2e DB, install Playwright Chromium, run `npm run test:e2e -- --reporter=line,html`, upload Playwright report/test-results artifacts on failure.

## Links to important documentation and ADRs

### Documentation (`docs/`)

- [Docs index](docs/README.md)
- [PRD](docs/01-PRD.md)
- [TRD](docs/02-TRD.md)
- [Requirements](docs/03-REQUIREMENTS.md)
- [Architecture](docs/04-ARCHITECTURE.md)
- [Database](docs/05-DATABASE.md)
- [API contract](docs/06-API-CONTRACT.md)
- [Risk engine](docs/07-RISK-ENGINE.md)
- [Security and privacy](docs/08-SECURITY-PRIVACY.md)
- [UI/UX](docs/09-UI-UX.md)
- [Test plan](docs/10-TEST-PLAN.md)
- [Roadmap](docs/11-ROADMAP.md)
- [Coding standards](docs/12-CODING-STANDARDS.md)
- [Operations: production config, backup/restore, migration rollback](docs/13-OPERATIONS-RECOVERY.md)


### Architecture Decision Records (`docs/adr/`)

- [ADR template](docs/adr/TEMPLATE.md)
- [0001 — Stack and approach](docs/adr/0001-stack-and-approach.md)
- [0002 — Async driver and env layout](docs/adr/0002-async-driver-and-env-layout.md)
- [0003 — Chat grounding and degraded mode](docs/adr/0003-chat-grounding-and-degraded-mode.md)
- [0004 — Auth error UX and rate limits](docs/adr/0004-auth-error-ux-and-rate-limits.md)
- [0005 — Hashed-token passports](docs/adr/0005-hashed-token-passports.md)
- [0006 — HMAC network identifiers](docs/adr/0006-hmac-network-identifiers.md)
- [0007 — Catalog-based translation](docs/adr/0007-catalog-based-translation.md)

## Known limitations

- **Optional PDF/OCR dependencies:** real PDF/OCR/image-OCR success paths may require optional runtime dependencies/tools (e.g. `fitz`/`pymupdf`, `pytesseract`/PIL, `tesseract`) that are not guaranteed in every local environment.
- **OCR success paths not fully verified:** OCR/PDF extraction success paths have not yet been fully verified end-to-end in this environment.
- **PostgreSQL-backed integration tests:** require a configured/migrated PostgreSQL `DATABASE_URL` (`postgresql+asyncpg://...`); locally they may be skipped when not configured, while CI is configured to fail fast on missing/misconfiguration/skip conditions.
- **Playwright + axe E2E:** requires migrated+seeded database, demo accounts, and Playwright browser install; CI runs in an isolated workflow environment.
- **External/LLM verification:** optional integrations depend on configuration/availability; unavailable sources must be treated as `inconclusive`/`not_checked` and never fabricated.
- **No destructive operations:** this runbook intentionally excludes database reset/drop/delete instructions.
- **Deprecation warnings observed in tests:** `slowapi` `asyncio.iscoroutinefunction`, Pydantic v2 class-based config in `app/schemas/auth.py`, and `passlib` argon2 metadata access (non-failing).

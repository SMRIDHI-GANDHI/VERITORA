# VERITORA

AI-assisted recruitment trust and job-fraud detection platform. VERITORA provides **decision support only** — it never labels a job or recruiter "fake" or "genuine". It outputs a risk indicator (0–100), a risk band, contributing factors, evidence, explicit unknowns, and recommended next steps.

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind + Vite + i18next |
| Backend | Python 3.12+ / FastAPI + SQLAlchemy 2 (async) + Alembic |
| Database | PostgreSQL (driver: `asyncpg`) |
| Storage | Private offer-letter storage with TTL cleanup |

## Prerequisites

- Node.js 18+ and npm
- Python 3.12+
- PostgreSQL 14+ (developed against PostgreSQL 18)

## Setup

### 1. Database

```sql
CREATE ROLE veritrust LOGIN PASSWORD '<your-password>';
CREATE DATABASE veritrust OWNER veritrust;
```

The backend uses the **async** SQLAlchemy driver, so `DATABASE_URL` must use `postgresql+asyncpg://`.

### 2. Backend

```bash
cd backend
python -m pip install -e ".[dev]"
cp .env.example .env        # then edit DATABASE_URL and SECRET_KEY
alembic upgrade head        # applies migrations 0001..0008
python -m app.scripts.seed_demo   # optional: synthetic demo users + scenarios
uvicorn app.main:app --reload --port 8000
```

- API: `http://localhost:8000` (prefix `/api/v1`)
- Liveness: `GET /healthz` (alias `GET /health`)
- Readiness: `GET /readyz` (503 if the database is unreachable)

> Run backend commands **from `backend/`** — `Settings` loads `.env` relative to the current working directory.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- App: `http://localhost:5173`
- Point at a different API with `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`).

## Demo accounts (after `seed_demo`)

| Email | Role | Password |
|---|---|---|
| `demo-user@veritora.example.com` | user | `DemoPass123!` |
| `demo-mod@veritora.example.com` | moderator | `DemoPass123!` |

Create an admin with `python -m app.scripts.create_admin --email you@example.com` (prompts for a password).

## Checks

```bash
# Backend
cd backend && ruff check . && mypy app && pytest -q

# Frontend
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build

# End-to-end (needs a migrated DB; the config starts API + Vite if not running)
cd backend && python -m app.scripts.seed_demo
cd ../frontend && npm run test:e2e

# Performance budgets against the production build
cd frontend && npm run test:perf
```

## Routes

| Route | Purpose |
|---|---|
| `/` | Landing with quick check and product principles |
| `/signin`, `/signup` | Authentication |
| `/dashboard` | Aggregates, risk-band distribution, recent activity |
| `/trustscan` | Unified verification entry point |
| `/analyze` | Job details / URL / message / offer-letter analysis |
| `/message-analyzer` | Opens the message tab; per-message evidence highlights and escalation callout |
| `/analysis/:id` | Full result, refresh, Trust Passport, translator |
| `/verify/company`, `/verify/recruiter` | Verification checks |
| `/reports`, `/reports/new` | Community reports (alerts until moderated) |
| `/history`, `/saved`, `/exposure` | History, saved opportunities, data exposure checker |
| `/passport/:token` | Public Trust Passport snapshot |
| `/chat` | Verification chatbot — grounded answers citing evidence, degraded/templated when the LLM is off |
| `/help/cybercrime` | Official reporting resources (1930, NCRP, CERT-In) |
| `/admin`, `/admin/network`, `/admin/watchlist`, `/admin/trends` | Moderator and admin tooling |

## Product rules

- No "fake"/"genuine" verdicts — only a risk indicator, band, factors, evidence, unknowns, next steps.
- Missing data is `unknown`, never evidence of fraud. Statuses: `checked`, `warning`, `inconclusive`, `not_checked`, `under_review`.
- External verification results are never fabricated; an unavailable source yields `inconclusive` or `not_checked`. Every external claim stores `source_url` + `checked_at`.
- Reports and ratings are user allegations until moderated. There is no public blacklist; the watchlist is internal, evidence-backed, and appealable.
- All external text (job posts, pages, uploads, chat) is untrusted data, never instructions.
- The rule engine works with `LLM_ENABLED=false`.
- VERITORA is not an official portal and never files complaints on a user's behalf.

## Documentation

Specs live in `docs/` (PRD, requirements, architecture, database, API contract, risk engine, security/privacy, UI/UX, test plan, roadmap) and architecture decisions in `docs/adr/`.>>>>>>> 1b45930 (chore: initial import of VERITORA project)

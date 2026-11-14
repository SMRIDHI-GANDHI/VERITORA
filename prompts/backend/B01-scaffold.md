# B01 — Backend scaffold, config, DB, migrations, CI
Agent: @backend-dev | Reads: 02-TRD, 04-ARCHITECTURE, 05-DATABASE, 12-CODING-STANDARDS

## Goal
A runnable FastAPI service with Postgres, Alembic, typed config, error handling, logging, health endpoints, and CI.

## Build
- `backend/` per TRD layout: `pyproject.toml` (ruff, mypy strict, pytest, pytest-asyncio, httpx), `app/main.py` with app factory, `config.py` (pydantic-settings reading all vars in `.env.example`), `core/errors.py` (problem JSON handlers, domain exceptions), `core/logging.py` (JSON logs, request-id middleware, PII-safe), `db/base.py`, `db/session.py`.
- Alembic initialized; first migration creates `users` and `audit_logs` only (later tasks add tables).
- Endpoints: `GET /healthz` (liveness), `GET /readyz` (DB check), under `/api/v1` prefix where applicable. CORS from env. Security headers middleware.
- `Dockerfile`, compose service `api`, Makefile or scripts: `dev`, `test`, `lint`, `migrate`.
- CI workflow: ruff, mypy, pytest, `alembic upgrade head` on empty DB, pip-audit.

## Acceptance
`docker compose up db && alembic upgrade head && uvicorn app.main:app` serves `/healthz` and `/readyz`. Validation errors return problem JSON with `request_id`. Tests: health, readiness with DB down, error mapping, config validation.

## Out of scope
Auth, business logic, other tables.

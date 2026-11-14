# ADR 0002 — Async database driver and environment layout
Status: Accepted
Context: The backend is FastAPI + SQLAlchemy 2.x (async) on PostgreSQL. `app/db/session.py` builds an `async_engine`, and `alembic/env.py` runs migrations through `async_engine_from_config`. Three places previously disagreed on the connection URL: `app/config.py` and `alembic.ini` used `postgresql+asyncpg://`, while the root `.env.example` used `postgresql+psycopg://` (a synchronous driver), which cannot be used by an async engine. There was also no per-directory env template and no `.gitignore`, so a real `backend/.env` holding a password could have been committed.

Decision:
- Use the async SQLAlchemy driver `asyncpg` exclusively. `DATABASE_URL` must be `postgresql+asyncpg://<user>:<password>@<host>:<port>/<db>`. The `psycopg` form is rejected because the engine is async.
- Keep `backend/app/config.py` as the single source of truth for the default URL; `alembic/env.py` overrides `sqlalchemy.url` from `settings.database_url`, so `alembic.ini` is a fallback only and is never edited per-environment.
- Backend env vars live in `backend/.env` (loaded relative to the process working directory, which is `backend/` for `uvicorn` and `alembic`). A `backend/.env.example` template documents the variables without secrets.
- Real env files are git-ignored (`.env`, `.env.*`, `backend/.env`, `frontend/.env`) while `.env.example` templates stay tracked via `!.env.example` negations.

Consequences: `DATABASE_URL` must use the `asyncpg` scheme or SQLAlchemy raises at engine creation; this is now stated in both env templates. A developer who runs commands from the repo root instead of `backend/` will not pick up `backend/.env` and must either `cd backend` or export the variable explicitly. The sync `psycopg` dependency is not installed and is not needed.

Alternatives considered: (1) Switching the app to a synchronous engine and `psycopg` — rejected, it would serialise DB access under async request handling. (2) Relying on `alembic.ini` for the URL — rejected, it duplicates state and drifts from `Settings`. (3) Storing only a root `.env` — rejected, because the backend is executed from `backend/`, so settings would not find it without extra configuration.

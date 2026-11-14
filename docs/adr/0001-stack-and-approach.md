# ADR 0001 — Stack and incremental approach
Status: Accepted
Context: Brief mandates React+TS, FastAPI, PostgreSQL, SQLAlchemy+Alembic; rule-based scoring first; incremental vertical slices.
Decision: Adopt stack in `02-TRD.md`; rule engine is deterministic and LLM-optional; identifiers HMAC-hashed for network detection; internal watchlist instead of public blacklist.
Consequences: Calibration needed before any probability wording; more moderation workload; graph kept in relational tables (NetworkX in-process) until scale demands a graph DB.

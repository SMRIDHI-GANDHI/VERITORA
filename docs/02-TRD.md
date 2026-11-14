# 02 — Technical Requirements Document (TRD)

## 1. Stack (pin exact versions in lockfiles)
| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18 + TypeScript (strict) + Vite | SPA |
| Styling | Tailwind CSS (class-based dark mode) | CSS variables for tokens |
| UI primitives | Radix UI / shadcn-style accessible components | |
| Data fetching | TanStack Query; typed API client | |
| Routing | React Router | |
| i18n | react-i18next (en, hi at launch) | |
| Charts / graph | Recharts; react-force-graph or Cytoscape.js for network | |
| Backend | Python 3.12, FastAPI, Pydantic v2, Uvicorn | |
| DB | PostgreSQL 16 | `pgvector` extension in Phase 2+ |
| ORM / migrations | SQLAlchemy 2.x (typed), Alembic | |
| Auth | Argon2 password hashing; short-lived JWT access + refresh in httpOnly cookie | |
| Rate limiting | slowapi (or equivalent) with Redis optional; in-memory for dev | |
| NLP/ML | scikit-learn baseline; spaCy; sentence-transformers (Phase 2+) | |
| Graph | NetworkX over relational tables | |
| Docs extraction | PyMuPDF, OCR (Tesseract) in Phase 3 | |
| HTTP client | httpx with custom safe transport (SSRF guard) | |
| Testing | pytest, pytest-asyncio, httpx TestClient, Vitest, Testing Library, Playwright (E2E), axe | |
| Lint/format | ruff, mypy (strict-ish) / ESLint, Prettier, tsc | |
| Containers | Docker Compose for local (api, db, web) | |
| Deploy (initial) | Vercel (web) + a Python host (Render/Railway/Fly) + managed Postgres | |

Do not add dependencies outside this table without an ADR. Do not install everything on day one; add per task.

## 2. Repository layout
```
veritrust/
  AGENTS.md  opencode.json  .env.example  docker-compose.yml
  docs/  prompts/  .opencode/
  backend/
    pyproject.toml  alembic.ini  alembic/versions/
    app/
      main.py  config.py  deps.py
      core/        security.py rate_limit.py errors.py logging.py ssrf.py
      db/          base.py session.py models/*.py
      schemas/     *.py              # Pydantic, mirror 06-API-CONTRACT
      api/v1/      auth.py analyze.py verify.py reports.py network.py
                   dashboard.py passports.py chat.py admin.py resources.py
      services/    analyzer/ risk/ verification/ reports/ network/ passports/ chat/
      repositories/
      config/      cyber_resources_in.json  signals.yaml  weights.yaml
    tests/  unit/ integration/ fixtures/
  frontend/
    package.json  vite.config.ts  tailwind.config.ts
    src/
      app/ (router, providers)  pages/  features/<feature>/  components/ui/
      lib/ (api client, types, a11y helpers)  i18n/ (en.json, hi.json)  theme/
```

## 3. Architectural constraints
- Layering: router → service → repository. No SQL in routers. No business logic in repositories.
- Rule engine is pure and deterministic: `analyze(input, context) -> AnalysisResult`; no network or LLM calls inside; verification results are passed in as evidence.
- External lookups go through `VerificationSource` interface adapters with timeout, retry limit, caching and result objects `{status, source_url, checked_at, details}`.
- LLM use (optional) is behind `LLMClient` interface; output validated against a schema; failure falls back to rules.
- All identifiers used for network matching are normalized then HMAC-hashed with a server secret before storage in `network_entities` (raw values only where strictly justified, encrypted, restricted).
- Model/rule version string recorded on every analysis (`rules-YYYY.MM.N`).

## 4. Non-functional requirements
| ID | Requirement | Target |
|---|---|---|
| NFR-PERF-1 | Rule-only analysis latency (p95, excluding external checks) | < 1.5 s |
| NFR-PERF-2 | URL scan hard limits | 10 s total, 2 MB body, 3 redirects |
| NFR-REL-1 | Source outage never fails the analysis; marks checks `inconclusive` | always |
| NFR-SEC-1 | OWASP ASVS L2 aligned controls (see 08) | |
| NFR-A11Y-1 | WCAG 2.2 AA, keyboard complete, reduced-motion respected | |
| NFR-I18N-1 | All UI strings externalized; en + hi complete | |
| NFR-OBS-1 | Structured JSON logs, request IDs, no PII/secrets in logs | |
| NFR-TEST-1 | Backend unit coverage ≥ 80% on services; every endpoint has authz test | |
| NFR-DATA-1 | Retention and deletion policy implemented for submissions | |
| NFR-CFG-1 | Cyber resources, weights, signal patterns configurable without code change | |

## 5. Conventions
- API: REST, JSON, `/api/v1`, `snake_case` JSON fields, ISO-8601 UTC timestamps, UUID ids, cursor pagination (`limit`, `cursor`).
- Errors: RFC 7807-style problem JSON `{type,title,status,detail,code,request_id}`.
- Env: pydantic-settings; all secrets from env; `.env.example` always current.
- Git: trunk-based with short branches `feat/<task-id>-slug`, Conventional Commits, one task ID per PR, tag `phase-N` at phase end.
- CI (add in B01/F01): lint, typecheck, test, build; migration check (`alembic upgrade head` on empty DB).

## 6. Local development
`docker compose up db` then backend `uvicorn app.main:app --reload`, frontend `npm run dev`. Seed synthetic demo data with `python -m app.scripts.seed_demo` (all demo rows flagged `is_synthetic=true` and labeled in UI).

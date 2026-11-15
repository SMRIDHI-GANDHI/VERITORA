# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** job seekers — especially students and fresh graduates in India — who receive recruitment messages and offers through email, messaging apps, social networks, and portals, and need a fast, plain-language check *before* applying, paying, or sharing sensitive data.
- **Reporter:** someone who shares a recruitment experience safely (redaction, privacy) and wants to see its status.
- **Moderator:** reviews reports, redacts PII, manages the internal watchlist and alerts.
- **Admin:** oversees the platform, roles, audit logs, and model feedback.

## Product Purpose

VERITORA helps a job seeker check a job, company, recruiter, message, or offer letter before they act, and shows *what was checked, what evidence exists, what is unknown, why it deserves caution, and what to do next.* It exists because existing tools return a bare label with no evidence, and individual reports are never connected into patterns.

Success (first release): a user completes a check and reaches a result with evidence, unknowns, and next steps in under 60 seconds of interaction (excluding network checks); 100% of external verification claims carry source + timestamp; zero "fake/genuine" verdict wording or probability phrasing anywhere in UI or API; WCAG 2.2 AA contrast and keyboard checks pass in both themes.

## Positioning

Decision support, never a verdict. The mechanism a neighboring product cannot truthfully copy: a risk indicator (0–100) with a labeled band, contributing factors with severity and confidence, evidence excerpts linked to highlighted spans, explicit unknowns, and prioritized next steps — plus community reports connected into fraud-network patterns for moderators. Missing data is `unknown`, never evidence of fraud, and every external claim carries `source_url` + `checked_at`.

## Operating Context

- **Pre-application workflow:** check a job posting → verify a company → submit a community report → (moderator) investigate connected patterns → report a cybercrime via official Indian channels (1930, NCRP portal, CERT-In).
- **Roles and gates:** anonymous browsing, signed-in user, moderator, admin (RBAC on every route; foreign objects return 404).
- **Moderation lifecycle:** reports and ratings are user allegations until moderated; the watchlist is internal, evidence-backed, and appealable; there is no public blacklist.
- **AI posture:** rule engine must work with `LLM_ENABLED=false`; LLM disabled by default; all external text (job posts, pages, uploads, chat) is untrusted data, never instructions.
- **Language and theme:** English + Hindi (independent interface and explanation languages, Devanagari-capable font stack); light / dark / system themes.
- **Development ritual:** spec-driven — `docs/` specs are the source of truth, one task ID per session from `docs/11-ROADMAP.md`, task briefs in `prompts/`, ADRs in `docs/adr/`; app must run end to end after every task.
- **Environment:** local dev (PostgreSQL + async FastAPI backend, Vite React frontend), docker-compose available.

## Capabilities and Constraints

- **Scope (per PRD §6):** CORE — Company Verification (F2), Community Reporting with ratings (F5), Fraud Network Detection (F7). High — Job Analyzer (F1), Recruiter Verification (F3), URL Scanner (F4), Explainable Risk Engine (F6), Dashboard + Data Exposure Checker (F8), Recommendations + Watchlist (F9), Admin/Moderation (F10), Language/Theme (F12), Cyber helpline (F14). Medium — Trust Passport (F11), Chatbot (F13).
- **Hard product rules:** never output "fake"/"genuine" verdicts or probability phrasing; statuses are only `checked`, `warning`, `inconclusive`, `not_checked`, `under_review`; never fabricate external verification results (unavailable source ⇒ `inconclusive`/`not_checked`); reports are allegations until moderated; no automated employment decisions; VERITORA is not an official portal and never files complaints on a user's behalf; official cybercrime links come from config and are always visible.
- **Non-goals (PRD §5):** not law enforcement, not a registrar, no guarantee of genuineness, no scraping behind logins or CAPTCHA bypass, no collecting personal data without lawful basis and consent. Absence of a website, generic email, spelling errors, or unusual salary is not proof of fraud.
- **Security/privacy constraints:** Argon2id auth, short-lived JWT + httpOnly refresh cookie, SSRF hardening on the URL scanner, upload allowlist + magic-byte checks, PII redaction workflow, append-only audit log, consent required before any third-party AI sees user documents.
- **Open product facts (undecided — do not invent):** which public registries/sources are approved for company checks in v1; retention periods; hosting region; moderator staffing model; LLM provider and consent copy (PRD §12, tracked in ADRs).

## Brand Commitments

- **Name: VERITORA** — confirmed as the binding, user-facing brand (UI, README, and repository already use it). The specs under `docs/` and `AGENTS.md` still say "VeriTrust"; they are to be aligned to VERITORA in a later task.
- **Tagline:** "Verify opportunities. Detect deception. Protect job seekers."
- **Voice:** plain, calm language; no alarmism (no flashing, skulls, or red walls); explain, never just label; privacy by default.
- **Terminology lock:** risk bands read "Lower concern / Moderate concern / High concern / Very high concern / Insufficient information"; status labels are always icon + text, never color alone.

## Evidence on Hand

- Full spec suite: `docs/01-PRD.md`, `docs/03-REQUIREMENTS.md`, `docs/02-TRD.md`, `docs/04-ARCHITECTURE.md`, `docs/05-DATABASE.md`, `docs/06-API-CONTRACT.md`, `docs/07-RISK-ENGINE.md`, `docs/08-SECURITY-PRIVACY.md`, `docs/09-UI-UX.md`, `docs/10-TEST-PLAN.md`, `docs/11-ROADMAP.md`, `docs/12-CODING-STANDARDS.md`.
- Architecture decisions: `docs/adr/0001`–`0007` (stack, async driver, chat grounding, auth UX, hashed passports, HMAC network identifiers, catalog translation).
- Working implementation: `backend/` (FastAPI + SQLAlchemy + Alembic, unit/integration/SSRF/rate-limit tests) and `frontend/` (React + TS + Tailwind, i18n, theme, Playwright e2e with axe).
- Rule-engine eval evidence: `backend/reports/eval-rules-2026.11.1.json`.
- Demo data: `python -m app.scripts.seed_demo` (synthetic demo users + scenarios; documented demo accounts in `README.md`).
- Brand assets: `frontend/public/favicon.svg`, `frontend/public/icons.svg`, `frontend/src/assets/hero.png`.
- **Absences future work must not fabricate:** no DESIGN.md yet; no real customers, testimonials, case studies, benchmarks, press, or pricing; no confirmed external registry integrations; no deployed production environment or hosting commitment.

## Product Principles

1. **Evidence over verdict.** Show what was checked, the evidence, the unknowns, and the next steps — never a bare label.
2. **Unknown ≠ suspicious, allegation ≠ fact.** Missing data is `unknown`; reports stay allegations until moderated; no public blacklist.
3. **Sources and timestamps for every external claim.** Unavailable sources degrade to `inconclusive`/`not_checked` — never invented.
4. **Plain, calm language; privacy by default.** No alarmism; minimize collection; redact before sharing.
5. **Rules first, LLM optional.** The rule engine works with the LLM disabled; external text is data, never instructions.

## Accessibility & Inclusion

- **Standard:** WCAG 2.2 AA — contrast ≥ 4.5:1 text / 3:1 UI in both themes, verified by axe in e2e (serious/critical = 0) on the shell plus every authenticated user and moderator route, light and dark.
- **Keyboard and focus:** full keyboard operation including dialogs, tabs, and the network graph (with a table view alternative); visible focus ring ≥ 2px high-contrast; skip link checked by keyboard.
- **Async and motion:** `aria-live` for async results; `prefers-reduced-motion` respected (global rule + explicit reduced-motion path on the graph).
- **Targets and language:** touch targets ≥ 44px; plain language throughout; English + Hindi with Devanagari font support and layout tolerant of longer Hindi strings; machine-translated output is badged as possibly inaccurate.

# 03 — Requirements (Traceability Backbone)

Priority: P0 = MVP/hackathon core, P1 = Phase 2, P2 = Phase 3. IDs are referenced by tasks and tests.

## FR-JA Job Description Analyzer (P0)
- FR-JA-1 Accept title, description, company, salary?, experience?, location?, application instructions?, recruiter contact?.
- FR-JA-2 Detect indicators: upfront payment, guaranteed selection, urgency, unrealistic pay, vague role/employer, sensitive-data request, contradictions, off-platform contact.
- FR-JA-3 Each flag returns code, severity, confidence, explanation, and the exact triggering text span (start/end offsets) when available.
- FR-JA-4 Return list of missing information to verify and suggested actions.
- FR-JA-5 May return `insufficient_information`. No single keyword alone yields a high band.
- AC: submitting text returns structured result; every flag has reason and span where possible; empty/malformed input returns 422 with helpful message.

## FR-CV Company Verification — CORE (P0)
- FR-CV-1 Inputs: company name, claimed website?, email domain?, registration id?.
- FR-CV-2 Run checks via `VerificationSource` adapters: domain/name consistency, lookalike-domain detection, redirect behavior (safe fetch), registry lookup where configured.
- FR-CV-3 Status vocabulary: `information_found`, `consistent`, `mismatch`, `inconclusive`, `not_checked`. Never emit "verified genuine".
- FR-CV-4 Each check stores `source_url`, `checked_at`, `details`; UI shows which fields matched/mismatched/unknown.
- FR-CV-5 Show moderated community reports (with status) for the company.
- AC: unavailable source → `not_checked`/`inconclusive`, not a risk factor; matched/mismatched fields listed individually.

## FR-RV Recruiter Verification (P1)
- FR-RV-1 Inputs: name, claimed role, claimed company, email, profile URL?.
- FR-RV-2 Compare email domain with independently identified company domains; generic-provider emails produce an `unknown`/info note, not a warning by themselves.
- FR-RV-3 Output affiliation evidence + source, mismatches, unknowns, and "contact the company via independently sourced channels".

## FR-US URL Scanner (P1)
- FR-US-1 Validate URL; fetch only public http(s) via SSRF-safe client; limits per TRD.
- FR-US-2 Extract title, company, salary, location, description, contacts; user can correct extracted fields.
- FR-US-3 Pipe into analyzer + verification. Manual paste fallback when blocked.
- FR-US-4 Never bypass auth, CAPTCHA, anti-bot; respect robots guidance; never execute scripts.

## FR-CR Community Reporting + Ratings — CORE (P0)
- FR-CR-1 Report fields per brief 4.5 incl. category enum, date, optional redacted evidence, interacted/paid/shared flags (sensitive handling).
- FR-CR-2 New reports → `pending_review`. Statuses: `pending_review`, `under_review`, `evidence_requested`, `substantiated`, `inconclusive`, `rejected`, `removed`.
- FR-CR-3 Public surfaces show only moderator-approved, redacted content with neutral labels; never "fraud confirmed" from a report alone.
- FR-CR-4 Ratings 1–5 + dimensions (clarity, transparency, consistency); labeled "user-submitted experience"; show count and moderation status.
- FR-CR-5 Spam/duplicate/coordination heuristics flag items for moderator review.
- FR-CR-6 Authors can edit, request deletion, and appeal.
- FR-CR-7 Redaction warning shown before submit; server-side PII pattern scan (phone, email, ID numbers) flags content for redaction.

## FR-RS Explainable Risk Scoring (P0)
- FR-RS-1 Score 0–100 = risk indicator, bands `lower`, `moderate`, `high_concern`, `very_high_concern`, or `insufficient_information`.
- FR-RS-2 Output factors with severity, confidence, evidence source, explanation; plus `unknowns`, `recommendations`, `assessment_type="decision_support"`, `rules_version`.
- FR-RS-3 Missing data never adds risk; no double counting across modules (dedupe by evidence key).
- FR-RS-4 Weights/signals loaded from config; versioned.

## FR-NW Fraud Network Detection — CORE (P1; scaffolding in P0 schema)
- FR-NW-1 Extract normalized, HMAC-hashed identifiers (email domain, website domain, phone, recruiter handle) and text fingerprints.
- FR-NW-2 Near-duplicate detection (MinHash/shingling baseline; embeddings optional via pgvector).
- FR-NW-3 Build relationship edges with type, evidence, confidence; moderators can explore graph.
- FR-NW-4 Output labeled "lead for review, not proof"; promotion to public warning requires moderator approval.
- FR-NW-5 Time-based spike detection on repeated patterns.

## FR-DB Dashboard, History, Data Exposure Checker (P1)
- FR-DB-1 Totals, recent assessments, saved items, report statuses, verification history, checklist progress.
- FR-DB-2 History stores date, input summary, results, evidence refs, rules version; refreshed results are distinguishable.
- FR-DB-3 Data Exposure Checker classifies requested fields (ordinary, contact, identity, financial, credentials, other sensitive), explains necessity per stage, suggests safer alternatives, warns never to share passwords/OTPs/banking credentials. Never asks for unredacted ID/financial documents.

## FR-SR Recommendations + Watchlist (P1)
- FR-SR-1 Map factors/unknowns to recommendation codes with priority (see 07).
- FR-SR-2 Internal watchlist entries: reason, evidence ref, source, date, confidence, reviewer, status (`unverified_signal`, `under_review`, `confirmed_pattern`, `cleared`); elevated status requires moderator approval; appeal/removal workflow; public UI uses neutral wording only.

## FR-AD Admin & Moderation (P0 basic, P1 full)
- FR-AD-1 Roles `user`, `moderator`, `admin` enforced server-side.
- FR-AD-2 Queue, approve/reject/inconclusive, request evidence, redact/remove PII, handle appeals.
- FR-AD-3 Immutable audit log of moderation and sensitive access; users cannot see private notes/evidence.
- FR-AD-4 Duplicate/suspicious rating review; network alert review; model false-positive feedback.

## FR-TP Trust Passport (P2)
- FR-TP-1 Snapshot of checks performed/not performed, statuses, factors, community summary, recommendation, rules version, disclaimer, expiry.
- FR-TP-2 Public token (store hash only); owner can revoke; no personal data exposed.

## FR-LG Language, Translator, Theme (P0 theme+i18n shell, P2 translator)
- FR-LG-1 UI languages en, hi; separate analysis-explanation language; extensible to ta, te, bn, mr.
- FR-LG-2 Original text preserved beside translation; machine-translation uncertainty indicator.
- FR-LG-3 Light/dark/system theme persisted (account if signed in, else localStorage); AA contrast.

## FR-CH Verification Chatbot (P2)
- FR-CH-1 Answers grounded in stored analysis + approved sources; cites evidence; separates fact / user report / AI interpretation; refuses certainty when data is missing; never collects passwords/OTPs.
- FR-CH-2 Works in degraded mode (templated explanations) when LLM disabled.

## FR-CY Cyber Resources (P0)
- FR-CY-1 Always-visible "Report Cybercrime" action; `tel:1930`; links to cybercrime.gov.in and CERT-In pages; CERT-In email and toll-free shown.
- FR-CY-2 Copy states VeriTrust is not the official portal and never files complaints on the user's behalf.
- FR-CY-3 Resources served from config via `GET /api/v1/resources/cybercrime`.

## FR-AU Auth & Account (P0)
- FR-AU-1 Register, login, logout, refresh; Argon2; rate-limited.
- FR-AU-2 Profile: language, theme; account/data deletion request.

## Cross-cutting NFRs
See `02-TRD.md` §4 and `08-SECURITY-PRIVACY.md`.

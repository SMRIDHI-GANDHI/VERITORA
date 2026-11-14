# 01 — Product Requirements Document (PRD)

**Product:** VeriTrust — AI-assisted recruitment trust, job-fraud detection and prevention.
**Tagline:** Verify opportunities. Detect deception. Protect job seekers.
**Status:** Draft v1.0  |  **Region focus:** India (configurable)

## 1. Problem
Job seekers, especially students and fresh graduates, receive recruitment messages and offers through email, messaging apps, social networks and portals. Fraudulent offers ask for fees, harvest identity or banking data, or impersonate real companies. Existing tools return a bare "fake/genuine" label with no evidence, and individual reports are never connected into patterns.

## 2. Vision
Help a job seeker check a job, company, recruiter, message or offer letter **before** applying, paying or sharing sensitive data, and show *what was checked, what evidence exists, what is unknown, why it deserves caution, and what to do next.*

## 3. Users
| Persona | Needs |
|---|---|
| Job seeker / student | Fast, plain-language check; safe next steps; Hindi support |
| Reporter | Share an experience safely (redaction, privacy) and see its status |
| Moderator | Review reports, redact PII, manage watchlist and alerts |
| Admin | Oversee platform, roles, audit logs, model feedback |

## 4. Goals
G1 Make pre-application checks easy. G2 Combine job-text, company, recruiter, URL and community evidence. G3 Explain, never just label. G4 Detect repeated patterns across reports. G5 Give practical steps and official reporting routes. G6 Accessible UI: light/dark, English + Hindi. G7 Protect privacy; never publish unverified allegations.

## 5. Non-goals and limits
Not law enforcement, not a registrar, no guarantee of genuineness. No public blacklist from unverified reports. No scraping behind logins, CAPTCHA bypass, or collecting personal data without lawful basis and consent. No automated employment decisions. AI output is never a legal finding. Absence of a website, generic email, spelling errors or unusual salary is not proof of fraud.

## 6. Scope and priority
CORE: Company Verification (F2), Community Reporting with ratings (F5), Fraud Network Detection (F7).
High: Job Analyzer (F1), Recruiter Verification (F3), URL Scanner (F4), Explainable Risk Engine (F6), Dashboard + Data Exposure Checker (F8), Recommendations + Watchlist (F9), Admin/Moderation (F10), Language/Theme (F12), Cyber helpline (F14).
Medium: Trust Passport (F11), Chatbot (F13).
(F-numbers follow the original 14-feature list.)

## 7. Key user journeys
A Check a job posting → B Verify a company → C Submit a community report → D Investigate connected patterns (moderator) → E Report a cybercrime via official channels. Detailed steps: see original brief section 5 and `03-REQUIREMENTS.md`.

## 8. Product principles (apply to every feature)
1. Evidence over verdict. 2. Unknown ≠ suspicious. 3. Allegation ≠ fact. 4. Sources and timestamps for every external claim. 5. Plain, calm language; no alarmism. 6. Privacy by default. 7. Rules first, LLM optional.

## 9. Success metrics
- First release: user completes check → result with evidence/unknowns/next steps in under 60 s of interaction (excluding network checks).
- 100% of external verification claims carry source + timestamp.
- 0 occurrences of "fake/genuine" verdict wording or probability phrasing in UI/API.
- Rule-engine recall on payment-request scenarios ≥ agreed target on labeled synthetic set; false-positive rate tracked on legitimate startup set.
- WCAG 2.2 AA contrast and keyboard checks pass in both themes.

## 10. Release definition
First release succeeds when the 11 outcomes in the original brief section 16 work end to end (language/theme choice, job submit, transparent analysis, company/recruiter check, risk view, report + rating, moderation visibility, related patterns, recommendations, cyber resources, history).

## 11. Risks
| Risk | Mitigation |
|---|---|
| False accusations of real companies | Moderation gate, neutral wording, appeal path, "reported ≠ confirmed" |
| Over-reliance on score | Show unknowns, confidence, disclaimer; score = decision support |
| Privacy harm from reports | Redaction, RBAC, minimization, retention rules |
| Source unavailability | Degrade to `inconclusive`/`not_checked` |
| Rating manipulation | Spam/duplicate/coordination detection, moderation |
| Prompt injection via job text | Treat as data; strict output schemas |

## 12. Open questions (track in ADRs)
Which public registries/sources are approved for company checks in v1? Retention periods? Hosting region? Moderator staffing model? LLM provider and consent copy?

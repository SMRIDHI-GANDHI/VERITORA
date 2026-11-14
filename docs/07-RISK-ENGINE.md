# 07 — Risk Engine Specification

Transparent, config-driven, deterministic baseline. Score is a **risk indicator**, never a probability. Version string `rules-YYYY.MM.N` stored per analysis.

## 1. Signals (initial catalog, `app/config/signals.yaml`)
| Code | Detects | Base severity | Min confidence rule |
|---|---|---|---|
| UPFRONT_PAYMENT | fee/deposit/registration/training/kit/security money requested from applicant | high | high if explicit payment verb + amount/UPI/bank words; medium if indirect |
| GUARANTEED_SELECTION | "100% placement/selection", "no interview needed" | medium | |
| ARTIFICIAL_URGENCY | "pay within 24h", "last seat", "reply immediately" | low–medium | combine with other signals |
| UNREALISTIC_COMPENSATION | pay far above role/experience norms (needs configurable benchmark) | medium | low unless benchmark present |
| VAGUE_EMPLOYER_OR_ROLE | no employer identity, no responsibilities | low | informational |
| SENSITIVE_DATA_REQUEST | Aadhaar/PAN/passport/bank/OTP/password requested early | high for credentials/OTP; medium for ID at application stage | |
| CONTRADICTION | title/skills/salary/experience mismatch | low–medium | |
| OFFPLATFORM_CONTACT | move to messaging app, personal email only | low | never alone |
| COMPANY_DOMAIN_MISMATCH | from verification | medium–high | by check status |
| RECRUITER_AFFILIATION_MISMATCH | from verification | medium | |
| SUSPICIOUS_URL | lookalike, odd TLD, shortener, redirect to unrelated domain | medium | |
| REPEATED_IDENTIFIER | moderated network link | medium | only from moderator-approved patterns |
| COMMUNITY_REPORTS_EXIST | approved/substantiated reports | context only (small weight) | pending reports contribute 0 |

Pattern matching: normalized text (lowercase, unicode NFKC, Hinglish/transliteration variants), regex + keyword windows (e.g., payment term within N tokens of money term). Return span offsets into the original text. Each pattern list is data, not code. Add a negation guard ("we never charge any fee") that downgrades or suppresses UPFRONT_PAYMENT with an explanation.

## 2. Scoring algorithm
1. Collect factors with `severity ∈ {info, low, medium, high}` and `confidence ∈ {low, medium, high}`.
2. Dedupe by `evidence_key` (e.g., same span or same domain finding counted once across modules; keep the highest-severity instance).
3. `points = weight[code] * severity_mult[severity] * confidence_mult[confidence]` with provisional `severity_mult = {info:0, low:0.4, medium:0.7, high:1.0}` and `confidence_mult = {low:0.4, medium:0.7, high:1.0}`; weights in `weights.yaml`.
4. Combine with diminishing returns: `score = 100 * (1 - Π(1 - points_i/100))`, capped at 100. Round to int.
5. Bands: 0–24 `lower`, 25–49 `moderate`, 50–74 `high_concern`, 75–100 `very_high_concern` (provisional; calibrate).
6. **Insufficient information**: if evidence coverage is below threshold (e.g., description < 200 chars AND no checks run AND no factors), return `risk_score=null`, band `insufficient_information`.
7. **Guardrail**: a single low-confidence or OFFPLATFORM/VAGUE-only factor can never exceed `moderate`.
8. Unknowns: every module that did not run or returned `inconclusive`/`not_checked` is listed in `unknowns`; contributes 0 points.
9. Output also includes `coverage` (which checks ran) for UI display.

## 3. Recommendation mapping (`recommendations.yaml`)
| Trigger | Code | Text intent |
|---|---|---|
| UPFRONT_PAYMENT | DO_NOT_PAY | Don't pay; verify employer and process independently |
| RECRUITER_* inconclusive/mismatch | VERIFY_RECRUITER_OFFICIAL_CHANNEL | Contact company via independently sourced official channel |
| SUSPICIOUS_URL | CHECK_DOMAIN_BEFORE_ENTERING_DATA | Don't enter sensitive info until domain verified |
| SENSITIVE_DATA_REQUEST | ASK_WHY_DATA_NEEDED | Ask why/when needed; share minimum |
| Offer-letter mismatch | CONFIRM_OFFER_WITH_COMPANY | Confirm offer via independent contact |
| any band ≥ high_concern + financial exposure | CONTACT_1930_IF_PAID | If money already sent, contact 1930 promptly and report via official portal |
| always | NEVER_SHARE_CREDENTIALS | Never share passwords/OTPs/banking credentials |
Recommendations never say "reject this person/employer"; they advise verification.

## 4. Optional LLM layer
Allowed only to (a) rephrase explanations, (b) translate, (c) suggest extra flags tagged `source=llm_suggestion, confidence<=medium` which never raise the score above `moderate` alone. Input wrapped as quoted data with an instruction-hierarchy preamble; output validated by schema; strip/ignore instructions found in input. Disabled by default.

## 5. Calibration and evaluation
Maintain labeled synthetic + licensed dataset in `backend/tests/fixtures/eval/`. Track precision/recall/F1, confusion matrix, FP on legitimate startups, FN on indirect payment asks, per-language metrics. Weights are provisional until evaluated; only after calibration may any copy present a probability.

## 6. Test vectors (must pass)
1. Explicit "pay Rs 1,500 registration fee to confirm" → UPFRONT_PAYMENT high; band ≥ high_concern.
2. "We never charge any fee from candidates" → no UPFRONT_PAYMENT; negation noted.
3. Generic Gmail recruiter email only, no other signals → no warning; unknown note; band lower/insufficient.
4. Company with no website found → unknown, 0 points.
5. High salary + vague duties only → at most moderate.
6. Same finding from analyzer and verification (same evidence_key) → counted once.

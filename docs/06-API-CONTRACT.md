# 06 — API Contract (v1)

Base: `/api/v1`. JSON, `snake_case`, UTC ISO-8601, UUIDs. Auth: `Authorization: Bearer <access JWT>`; refresh via httpOnly cookie. Roles: `anon`, `user`, `moderator`, `admin`. All routes rate-limited. Errors use problem JSON:
```json
{"type":"about:blank","title":"Validation error","status":422,"detail":"...","code":"VALIDATION_ERROR","request_id":"..."}
```
Rate-limit rejections use the same shape with `status:429`, `code:"RATE_LIMITED"` and a `Retry-After` header (seconds). `/auth/register` is limited to 10/minute per client; `/auth/login` and `/auth/refresh` to 5/minute. A duplicate registration returns `400` with `detail` explaining that the account exists and suggesting sign-in; login stays generic (`401 Invalid credentials`) so it does not reveal whether an account exists.

Pagination: many list endpoints use `?limit=20&cursor=<opaque>` → `{items:[...], next_cursor:null|string}`. Endpoint-specific schemas below document any different cursor semantics.

## Endpoints
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | /auth/register, /auth/login, /auth/refresh, /auth/logout | anon/user | Account |
| GET/PATCH | /me | user | Profile, language, theme |
| DELETE | /me | user | Request account/data deletion |
| POST | /analyze/job | user | Analyze pasted job details |
| POST | /analyze/message | user | (P1) Analyze conversation |
| POST | /analyze/offer-letter | user | (P2) Upload offer letter (multipart) |
| POST | /scan/url | user | (P1) Safe-scan public job URL |
| POST | /verify/company | user | Company checks |
| POST | /verify/recruiter | user | (P1) Recruiter checks |
| GET | /companies/{id} | user | Company profile + approved report summary |
| POST | /reports | user | Submit report (→ pending_review) |
| GET | /reports | user | Search approved/visible reports |
| PATCH/DELETE | /reports/{id} | owner | Edit / request deletion |
| POST | /reports/{id}/appeal | owner | Appeal moderation outcome |
| POST | /companies/{id}/ratings | user | Submit experience rating |
| GET | /network/search | moderator (public summary for approved patterns) | Related patterns |
| GET | /analyses, /analyses/{id} | owner | History, detail |
| POST | /analyses/{id}/refresh | owner | Re-run checks, creates new analysis linked via supersedes_id |
| GET | /dashboard | user | Dashboard aggregates |
| POST | /data-exposure/check | user | Classify requested fields (items/text) |
| GET | /saved | user | List saved opportunities |
| POST | /saved | user | Save opportunity (analysis_id/title/notes) |
| GET | /checklist | user | List checklist progress items |
| POST | /checklist | user | Upsert checklist item progress (item_key/completed/meta) |
| GET | /passports | owner | List my Trust Passports |
| POST | /passports | owner | Create Trust Passport snapshot link |
| GET | /passports/{token} | anon | View public passport snapshot (404 if not found/expired/revoked) |
| DELETE | /passports/{id} | owner | Revoke passport (204) |
| POST | /explanations/translate | user | Translate fixed recommendation/factor explanations (original preserved) |
| POST | /explanations/wording | user | Rule-based plain-language explanation of formal/manipulative clauses |
| POST | /chat/sessions | user | Create chat session (optional analysis_id/title) |
| GET | /chat/sessions | user | List my chat sessions |
| GET | /chat/sessions/{id} | owner | Get chat session with messages |
| POST | /chat/sessions/{id}/messages | user | Send message and receive grounded assistant reply |
| GET | /admin/reports; PATCH /admin/reports/{id} | moderator | Queue / update status |
| GET/PATCH | /admin/watchlist, /admin/watchlist/{id} | moderator | Watchlist mgmt |
| GET | /admin/network/alerts | moderator | Graph alerts |
| GET | /admin/audit-logs, /admin/metrics | admin | Audit log review (redacted metadata) and operational metrics; see schemas below |
| POST | /feedback/analysis/{id} | user | Mark false positive / helpful |
| GET | /resources/cybercrime | anon | Official resources |

## Core schemas
**JobAnalyzeRequest**: `title:str(1..200)`, `description:str(20..20000)`, `company_name:str?`, `salary_text:str?`, `experience_level:str?`, `location:str?`, `application_instructions:str?`, `recruiter_contact:str?`, `company_website:str?`, `explanation_language:"en"|"hi"?`.

**AnalysisResult**
```json
{
  "id":"uuid","assessment_type":"decision_support","rules_version":"rules-2026.11.1",
  "risk_score":72,"risk_band":"high_concern",
  "summary":"Several warning signs need independent verification.",
  "risk_factors":[{"code":"UPFRONT_PAYMENT","severity":"high","confidence":"high",
     "evidence":{"excerpt":"pay Rs 2000 registration fee","span":{"start":120,"end":150}},
     "source":{"type":"job_text"},"explanation":"..."}],
  "verification":[{"check_type":"domain_consistency","status":"mismatch",
     "matched_fields":[],"mismatched_fields":["email_domain"],"unknown_fields":["registry"],
     "source_url":"https://...","checked_at":"2026-11-10T10:00:00Z"}],
  "unknowns":["Recruiter affiliation has not been independently confirmed."],
  "missing_information":["Official careers page link"],
  "recommendations":[{"code":"DO_NOT_PAY","priority":1,"text_key":"rec.do_not_pay"}],
  "community":{"approved_report_count":2,"labels":["community_reports_exist"],"note":"User-submitted; not verified facts."},
  "disclaimer_key":"disclaimer.decision_support","created_at":"..."
}
```
`risk_score` may be `null` with `risk_band:"insufficient_information"`.

**ExplanationTranslation** (`POST /explanations/translate`)
Request: `{"language":"en"|"hi","recommendations":[...],"risk_factors":[...]}`. Response: `{language, recommendations, risk_factors, disclaimer, translation_note}`. Every translated item keeps its original text (`text_original` / `explanation_original`) and includes a `translation` object with `provider`, `confidence`, `uncertain`, and `note`. Catalog entries are fixed templates, not external verification.

**WordingExplanation** (`POST /explanations/wording`)
Request: `{"text":"..."}` (untrusted external wording; treated as data, never instructions). Response:
```json
{"original_text":"...",
 "explanations":[{"clause":"registration fee","explanation":"Requests for upfront payment require strong independent verification of the employer and process.","confidence":"medium","method":"rule_based"}],
 "translation":{"provider":"none","source_language":"unknown","target_language":"en","confidence":"high","uncertain":false,"note":null}}
```
When no rule matches, `clause` is `null` and the explanation says no specific pattern was detected with `confidence:"low"`. The endpoint never returns a verdict or external verification result.

**VerifyCompanyRequest**: `company_name`, `website?`, `email_domain?`, `registration_id?`. Response: `{company_id?, checks:[VerificationCheck], community:{...}, overall_status, checked_at}`; `overall_status` ∈ the 5 statuses.

**ReportCreate**: `company_name`, `job_title?`, `job_url?`, `recruiter_identifier?`, `category` ∈ `payment_request|impersonation_concern|suspicious_link|fake_offer_concern|data_request|misleading_job_details|other`, `description(30..5000)`, `occurred_on?`, `interacted?`, `paid?`, `shared_info?`, `evidence_ids?`. Response includes `moderation_status:"pending_review"` and `pii_warnings:[...]`.

**ReportPublic** (never includes reporter identity or raw identifiers): `id, company, category, public_summary, moderation_status, occurred_on_approx, label:"user_submitted_report"`.

**RatingCreate**: `rating 1..5`, `dimensions:{clarity,transparency,consistency 1..5}`, `review_text?`.

**ModerationUpdate**: `action ∈ approve|reject|mark_inconclusive|request_evidence|remove|redact`, `reason:str`, `public_summary?`, `private_note?`.

**DashboardResponse** (`GET /dashboard`)
```json
{"totals":{"analyses":3,"reports":1,"saved_opportunities":2},
 "risk_band_distribution":{"lower":1,"moderate":1,"high_concern":1},
 "recent_analyses":[{"id":"uuid","risk_band":"lower","created_at":"..."}],
 "report_statuses":[{"id":"uuid","moderation_status":"approved"}],
 "checklist_progress":{"completed":2,"total":3}}
```
Counts reflect the calling user's own rows; `checklist_progress.total` is the number of distinct checklist items tracked by that user.

**SavedOpportunity** (`GET/POST /saved`): `{id, analysis_id, title, notes}`. List response: `{items:[SavedOpportunity], next_cursor:null}`.

**ChecklistItem** (`GET/POST /checklist`): `{item_key, completed, meta}`. List response: `{items:[ChecklistItem]}`.

**DataExposureResponse** (`POST /data-exposure/check`)
Request: `{"items":["Aadhaar number","OTP"]}` or `{"text":"Aadhaar number, OTP"}`.
Response:
```json
{"items":[{"item":"OTP","category":"credentials","categories":["credentials"],
   "matched_as":"Credentials/OTP","necessity_by_stage":"Not appropriate at any hiring stage.",
   "why_may_be_unnecessary":"Never share passwords, OTPs, or PINs with recruiters...",
   "safer_alternative":"Refuse and verify the request through official company channels.",
   "necessity":{"by_stage":"...","why_may_be_unnecessary":"..."},
   "warning":"Never share passwords, OTPs, banking credentials, or CVV with anyone.",
   "safer_alternatives":["..."]}],
 "results":[...],"grouped":{"credentials":[...]},
 "has_high_risk":true,"hard_warning":true,
 "hard_warning_message":"Never share passwords, OTPs, banking credentials, or CVV with anyone.",
 "guidance":["...","Do not upload unredacted ID or financial documents here."],
 "note":"Do not upload unredacted ID or financial documents here."}
```
`category` ∈ `ordinary|contact|identity|financial|credentials|other_sensitive`. `has_high_risk` is true when any item is a credential/OTP/banking secret. `items` and `results` are the same array; `has_high_risk` and `hard_warning` are the same flag.

**ChatSession** (`POST /chat/sessions`, `GET /chat/sessions`, `GET /chat/sessions/{id}`)
Request: `{"analysis_id":"uuid?","title":"string?"}`. `analysis_id` must belong to the caller (404 otherwise).
Response: `{id, analysis_id, title, created_at}`; the detail endpoint also returns `messages`.

**ChatMessage** (`POST /chat/sessions/{id}/messages`)
Request: `{"message":"string"}` (max 4000 characters).
Response:
```json
{"session_id":"uuid","stored":true,"warning":null,"injection_detected":false,
 "user_message":{"id":"uuid","role":"user","content":"...","citations":[],"statement_types":[],
                 "mode":null,"created_at":"..."},
 "assistant_message":{"id":"uuid","role":"assistant","content":"...",
   "citations":["ev:analysis","ev:factor:UPFRONT_PAYMENT","ev:check:domain_consistency",
                "ev:resource:helpline_1930"],
   "statement_types":["fact","ai_interpretation"],"mode":"templated","created_at":"..."}}
```
- `citations[]` are **evidence ids** that exist in the evidence pack; `ev:analysis`, `ev:factor:<CODE>`, `ev:check:<TYPE>`, `ev:community`, `ev:recommendation:<CODE>`, `ev:unknown`, `ev:resource:<ID>`.
- `statement_types[]` labels the statements as `fact` (recorded by the rule engine or an approved source), `user_report` (unverified user allegation) or `ai_interpretation` (general guidance).
- `mode` is `templated` when the LLM is disabled or its output failed validation, `llm` when a validated LLM answer was used.
- **Credential rule:** a message containing a password, OTP, PIN, banking detail or unredacted ID number is refused. `stored` is `false`, `user_message` is `null`, `warning` explains why, and **nothing is persisted**.
- **Prompt-injection rule:** instruction-like content is stripped before storage, `injection_detected` is `true`, and `warning` explains that it was ignored.
- 404 for another user's session (do not reveal that it exists).

**ChatTrends** (`GET /admin/analytics/trends?weeks=8`, moderator/admin)
```json
{"window_weeks":8,"week_start":"2026-09-21","generated_at":"...",
 "approved_report_total":12,
 "weekly":[{"week_start":"2026-09-21","count":1}, ...],
 "total_by_category":{"payment_request":5},
 "rising_categories":[{"category":"payment_request","previous_count":1,"current_count":4,"delta":3}]}
```
Only moderator-approved reports are counted; the current incomplete week is excluded from the weekly series.

**TrustPassportCreate** (`POST /passports`, owner)
Request: `{"analysis_id":"uuid","expires_in_days":30}` (`expires_in_days` optional, clamped 1..365, default 30). `analysis_id` must belong to the caller (404 otherwise).
Response (201): `{"id":"uuid","analysis_id":"uuid","token":"<returned once>","expires_at":"...","created_at":"...","note":"Store this token securely. It will not be shown again."}`. The server stores only a SHA-256 hash of the token; the raw token is never persisted.

**MyPassportListItem** (`GET /passports`, owner)
Response: `{"items":[{"id":"uuid","analysis_id":"uuid","created_at":"...","expires_at":"...","revoked_at":"...|null","status":"active|expired|revoked","risk_band":"...|null","risk_score":number|null,"summary":"...|null","rules_version":"...|null"}],"next_cursor":null}`. Items are derived from the immutable snapshot created at issuance.

**TrustPassportPublic** (`GET /passports/{token}`, anon)
Returns the immutable snapshot plus `{"passport_id":"uuid","expires_at":"...","created_at":"...","revoked":false}`. Returns 404 if the token is unknown, expired, or revoked. Snapshot fields include `assessment_type`, `rules_version`, `risk_score`, `risk_band`, `summary`, `risk_factors`, `checks`/`checks_performed_and_not_performed` (expected checks marked `not_checked` when not performed), `unknowns`, `missing_information`, `recommendations`, `community` (approved-report summary only), `disclaimer_key`, `analysis_created_at`, `refresh_guidance`, and `no_personal_data:true`. No personal data is included.

**TrustPassportRevoke** (`DELETE /passports/{id}`, owner)
204 No Content on success (idempotent in effect for an already-revoked owned passport); 404 if not found/not owned.

**AdminAuditLogs** (`GET /admin/audit-logs`, admin)
- **Authorization:** admin only (`require_role("admin")`). Unauthorized/unauthenticated requests return problem JSON per global auth/error handling.
- **Query parameters (current implementation):**
  - `limit` (int, optional, default `50`): FastAPI validation `ge=1`, `le=200`.
  - `cursor` (string|null, optional, default `null`): offset token for the current implementation (not keyset pagination; not cryptographically opaque; not guaranteed stable across data changes).
  - `action` (string|null, optional): exact-match filter on audit `action`.
  - `resource_type` (string|null, optional): exact-match filter on audit `resource_type`.
- **Ordering:** `AuditLog.timestamp DESC, AuditLog.id DESC` (applied before filtering pagination slice in the current implementation).
- **Pagination behavior (exact):** rows are loaded for the requested filters, then `start` is derived from `cursor`: if `cursor` is provided, `start = max(int(cursor), 0)`; if `cursor` cannot be parsed as an integer, `start = 0`. `page = rows[start : start + limit]`. `next_cursor = str(start + limit)` when more rows remain after the page, otherwise `null`. Because this is offset-based over the fetched result set, inserts/deletes or changing filters can shift page boundaries.
- **Response (200):**
```json
{
  "items": [
    {
      "id": "string",
      "actor_id": "string|null",
      "action": "string|null",
      "resource_type": "string|null",
      "resource_id": "string|null",
      "timestamp": "string|null",
      "request_id": "string|null"
    }
  ],
  "next_cursor": "string|null"
}
```
- **Field/nullability/timestamp details:** `id` is returned as a string. `actor_id` is the actor UUID serialized as a string when present, else `null`. `action`, `resource_type`, `resource_id`, and `request_id` are returned as stored values or `null` when absent. `timestamp` is `datetime.isoformat()` (UTC-aware per storage/model) when present, else `null`.
- **Privacy/redaction:** response includes redacted, non-PII event metadata only. It does **not** expose `ip_hash`, raw IP addresses, request/response bodies, headers, secrets, tokens, credentials, or PII fields.
- **Best-effort read-failure behavior:** if audit log query/loading fails, the handler returns `{"items":[],"next_cursor":null}` and does not leak internal details. **An empty result therefore does not always mean there are no audit events** (it may indicate no matches, cursor past end, or a read/query failure).

**AdminMetrics** (`GET /admin/metrics`, admin)
- **Authorization:** admin only (`require_role("admin")`). Unauthorized/unauthenticated requests return problem JSON per global auth/error handling.
- **Request:** no query parameters.
- **Response (200, current implementation):**
```json
{
  "analyses": 0,
  "reports": 0,
  "reports_by_status": {"pending_review": 0},
  "users_by_role": {"user": 0, "moderator": 0, "admin": 0},
  "watchlist_entries": 0,
  "audit_events": 0,
  "generated_at": "2026-11-15T00:00:00+00:00"
}
```
- **Field details:** `analyses` (int) count of job analyses; `reports` (int) count of community reports; `reports_by_status` (object/map string→int) counts by `moderation_status` (unknown/missing status bucketed as `"unknown"`); `users_by_role` (object/map string→int) counts by user role (missing role bucketed as `"unknown"`); `watchlist_entries` (int) count of watchlist entries; `audit_events` (int) count of audit log events (`COUNT(*)` with fallback to counting IDs if count query fails); `generated_at` (string|null) UTC ISO-8601 timestamp set when metrics generation runs (`datetime.now(UTC).isoformat()`), otherwise `null`.
- **Best-effort behavior:** metric collection is best-effort; failures during collection/commit are handled without leaking internal details (rollback attempted on exception) and the endpoint returns the current metrics object (defaults/partial values possible depending on where a failure occurs).
- **Audited access:** a successful metrics access path records an audit event with action `admin.metrics.view`, `resource_type` `admin_metrics`, actor = requesting admin, and request/IP-hash context via the audit logger (audit record stored server-side; not included in the metrics response). The response contains aggregate operational counts only and must not expose secrets, credentials, tokens, PII, or other sensitive internal details.

## Health
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | /healthz, /health | anon | Liveness (no DB dependency) |
| GET | /readyz | anon | Readiness (executes `SELECT 1`; 503 when the DB is unreachable) |

## Cyber resources (must match exactly; served from config)
```json
{"country":"IN","disclaimer_key":"cyber.not_official_portal","reviewed_at":"<release date>",
 "resources":[
  {"id":"ncrp","type":"portal","label":"National Cyber Crime Reporting Portal","url":"https://cybercrime.gov.in/","primary":true},
  {"id":"helpline_1930","type":"phone","label":"Cybercrime helpline (financial cyber fraud)","tel":"1930","href":"tel:1930","primary":true},
  {"id":"certin","type":"website","label":"CERT-In","url":"https://www.cert-in.org.in/"},
  {"id":"certin_contact","type":"website","label":"CERT-In incident response contact","url":"https://www.cert-in.org.in/s2cMainServlet?pageid=CONTACTUS"},
  {"id":"certin_email","type":"email","label":"CERT-In incident email","email":"incident@cert-in.org.in"},
  {"id":"certin_tollfree","type":"phone","label":"CERT-In toll-free","tel":"1800-11-4949"}
 ]}
```
Copy rules: 1930 + portal are the primary routes; CERT-In is an incident-response body, not a replacement for a police/cybercrime complaint; VeriTrust is not the official portal and does not file complaints. Re-verify against official sources before each release.

## Contract rules
Endpoints that expose reports return only moderator-approved, redacted fields. 403 vs 404: use 404 for resources the caller may not know exist. Never echo raw submitted text containing flagged PII in public responses. FastAPI serves runtime OpenAPI at `/openapi.json`, but no exported `docs/openapi.json` artifact or CI OpenAPI export/drift-check workflow is currently maintained in this repository.

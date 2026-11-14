# VERITORA --- Complete Product Flow, Interface Walkthrough & Technical Blueprint

> **Project:** VERITORA\
> **Purpose:** An AI-assisted platform that helps users assess potential
> fake-job and recruitment scams.\
> **Document scope:** This document consolidates the VERITORA planning
> discussion beginning with the request for a detailed, step-by-step
> interface flowchart and carries forward the decisions made afterward,
> including authentication, scanner inputs, architecture, database
> design, APIs, AI pipeline, team division, development roadmap,
> testing, and visual direction.

------------------------------------------------------------------------

## 1. Project overview

VERITORA is a recruitment-safety platform where users can submit job
postings, recruiter messages, company details, recruiter details, or
URLs for analysis. The system extracts relevant information, checks for
warning signs, applies rule-based and machine-learning analysis,
consults available verification signals, and presents an explainable
risk assessment.

The platform should help users make more informed decisions. It must not
claim that a job is definitely fraudulent merely because one suspicious
keyword appears. Likewise, a low-risk result or the absence of detected
warning signs is not proof that an opportunity is legitimate.

### Core goals

-   Let users assess suspicious job opportunities through multiple input
    methods.
-   Explain the warning signs behind an assessment.
-   Keep a history of previous analyses.
-   Let users save jobs and submit community reports.
-   Provide moderation tools for handling community-submitted reports.
-   Give administrators useful platform-level analytics.
-   Keep the experience understandable, responsive, and consistent.

### Important product decisions

  -----------------------------------------------------------------------
  Decision                            Final direction
  ----------------------------------- -----------------------------------
  Authentication                      Users must log in to use scanner
                                      tools. Public visitors may explore
                                      public pages.

  Scanner input methods               Support all three: paste text,
                                      enter a URL, and upload a
                                      screenshot.

  Main development priority           Balance frontend, backend,
                                      database, and AI/ML work.

  Results experience                  Use one reusable Results page for
                                      all scanner types.

  Analysis storage                    Use a central `analysis_runs` table
                                      with scanner-specific detail
                                      tables.

  Risk communication                  Present a transparent risk index
                                      and supporting evidence; do not
                                      label an uncalibrated score as a
                                      fraud probability.

  Visual direction                    Base VERITORA's website colour
                                      theme on the attached Figma
                                      reference, **Bean Scene Coffee
                                      Landingpage**. Exact colour values
                                      still need to be checked against a
                                      screenshot or the actual design
                                      canvas.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 2. Complete user journey --- from the first screen to the result

## 2.1 High-level flowchart

``` mermaid
flowchart TD
    A[Visitor opens VERITORA] --> B[Landing Page]
    B --> C{What does the visitor choose?}
    C -->|Explore| D[About / How It Works / Features]
    D --> B
    C -->|Use a scanner| E{Authenticated?}
    C -->|Register or Login| F[Authentication]
    E -->|No| F
    E -->|Yes| G[Dashboard]
    F --> H{Authentication successful?}
    H -->|No| F
    H -->|Yes| I[Return to intended scanner or Dashboard]
    I --> G
    G --> J[Choose a scanner]
    J --> K{Scanner type}
    K -->|Job Scanner| L[Choose text / URL / screenshot]
    K -->|Message Analyzer| M[Paste recruiter message]
    K -->|Company Checker| N[Enter company details]
    K -->|Recruiter Checker| O[Enter recruiter details]
    K -->|URL Checker| P[Enter supported URL]
    L --> Q[Validate and extract input]
    M --> Q
    N --> Q
    O --> Q
    P --> Q
    Q --> R[Normalize data]
    R --> S[Rule-based checks]
    S --> T[ML / NLP analysis]
    T --> U[Company, domain and community signals]
    U --> V[Risk engine]
    V --> W[Save analysis and evidence]
    W --> X[Generate explanation]
    X --> Y[Shared Results Page]
    Y --> Z{User's next action}
    Z -->|Save| AA[Saved Jobs]
    Z -->|Report| AB[Submit Community Report]
    Z -->|Download| AC[Download Report]
    Z -->|Review later| AD[Analysis History]
    Z -->|Analyze another| G
```

## 2.2 Step-by-step interface flow

### Step 1 --- Visitor opens the website

**Interface:** Landing Page

The landing page is the first screen for both new and returning
visitors.

Suggested sections:

1.  Navigation bar
    -   VERITORA logo
    -   Home
    -   About
    -   How It Works
    -   Features
    -   Login
    -   Get Started / Register
2.  Hero section
    -   Clear headline explaining recruitment-scam awareness.
    -   Short supporting text.
    -   Primary call to action: **Scan a Job** or **Get Started**.
    -   Secondary action: **Learn How It Works**.
3.  Feature overview
    -   Job Scanner
    -   Message Analyzer
    -   Company Checker
    -   Recruiter Checker
    -   URL Checker
4.  How it works
    -   Submit information.
    -   VERITORA checks signals.
    -   Review the explanation and suggested next steps.
5.  Trust and safety explanation
    -   Explain that the tool provides an assessment, not a guarantee.
    -   Explain that users should independently verify important
        details.
6.  Footer
    -   About
    -   Contact / support (if implemented)
    -   Privacy and terms (if implemented)

**User action:** The visitor clicks a scanner call-to-action or a
feature that requires scanning.

**System response:** Check whether the visitor is authenticated.

### Step 2 --- Authentication gate

**Rule:** Scanner tools require login.

If the visitor is logged out:

1.  Redirect them to the Login page.
2.  Preserve the intended destination using a safe internal redirect,
    such as the requested scanner route.
3.  After successful login or registration, return them to that scanner.
4.  If no intended destination exists, send them to the Dashboard.

Do not accept arbitrary external redirect URLs from query parameters.

### Step 3 --- Register or log in

**Interfaces:** Register, Login, Forgot Password

**Register page fields:** - Name - Email - Password - Confirm password -
Agreement to applicable terms/privacy notice

**Login page fields:** - Email - Password - Login button - Link to
Forgot Password - Link to Register

**Forgot Password page:** - Email input - Submit reset request - Clear
success/error feedback

**Backend responsibilities:** - Validate input. - Enforce unique email
addresses. - Hash passwords using Argon2 or bcrypt. - Create and verify
authentication tokens. - Apply role-based access control. - Never store
plaintext passwords.

**Successful login:** Create the authenticated session/token and
redirect to the originally requested scanner or the Dashboard.

### Step 4 --- Dashboard

**Interface:** User Dashboard

The dashboard is the user's main workspace after login.

Suggested layout:

-   Sidebar navigation:
    -   Dashboard
    -   Job Scanner
    -   Message Analyzer
    -   Company Checker
    -   Recruiter Checker
    -   URL Checker
    -   Analysis History
    -   Saved Jobs
    -   Community Reports
    -   Profile & Settings
-   Main welcome area.
-   Quick scanner cards.
-   Recent analyses.
-   Saved jobs preview.
-   Summary statistics, such as number of analyses completed.
-   Helpful safety guidance.

The dashboard should make the next action obvious: choose a scanner or
reopen a previous analysis.

### Step 5 --- Choose a scanner

VERITORA has five scanner entry points:

  -----------------------------------------------------------------------
  Scanner                 What the user submits   Main purpose
  ----------------------- ----------------------- -----------------------
  Job Scanner             Job text, URL, or       Assess a job posting
                          screenshot              

  Message Analyzer        Recruiter or employer   Assess suspicious
                          message                 communication

  Company Checker         Company name and        Review company-related
                          available details       signals

  Recruiter Checker       Recruiter name and      Review
                          available details       recruiter-related
                                                  signals

  URL Checker             A supported public URL  Assess URL and
                                                  page-related signals
  -----------------------------------------------------------------------

Each scanner should have a clear title, a short explanation, input
instructions, a submit button, and validation messages.

------------------------------------------------------------------------

# 3. Job Scanner --- detailed interface and processing flow

The Job Scanner is the main end-to-end workflow and must support three
input methods.

## 3.1 Job Scanner screen

Show three input options as tabs or cards:

1.  **Paste Job Text**
2.  **Enter Job URL**
3.  **Upload Screenshot**

The user chooses one method. All three methods eventually produce the
same normalized job representation so that the later analysis stages can
be shared.

## 3.2 Input method A --- Paste job text

**Interface elements:** - Large text area. - Optional job title field. -
Optional company name field. - Submit / Analyze button. - Clear button.

**Flow:**

1.  User pastes the job description.
2.  Frontend checks that the input is not empty.
3.  Frontend applies reasonable length limits.
4.  User submits.
5.  Backend validates the request.
6.  Extraction service identifies available fields.
7.  Data is normalized.
8.  The common analysis pipeline begins.

## 3.3 Input method B --- Enter a job URL

**Interface elements:** - URL input. - Short note that only supported
public pages can be processed. - Analyze URL button.

**Flow:**

1.  User enters a job-posting URL.
2.  Frontend checks basic URL formatting.
3.  Backend validates the URL and permitted scheme.
4.  Safe retrieval service attempts to fetch the supported public page.
5.  Page text is extracted.
6.  Extracted text is normalized into the common job structure.
7.  The common analysis pipeline begins.

**Security requirements:** - Prevent server-side request forgery
(SSRF). - Allow only appropriate URL schemes, normally HTTP/HTTPS. -
Block private, loopback, link-local, and internal network
destinations. - Re-check redirect destinations so redirects cannot reach
blocked addresses. - Apply timeouts and response-size limits. - Handle
unsupported pages, blocked pages, and extraction failures gracefully. -
Do not treat a failed page retrieval as evidence that the job is
fraudulent.

## 3.4 Input method C --- Upload screenshot

**Interface elements:** - Upload area / drag-and-drop zone. - Supported
file-type and size guidance. - Image preview. - Remove / replace
option. - Analyze Screenshot button.

**Flow:**

1.  User uploads a screenshot of the job posting.
2.  Frontend checks file type and size.
3.  Backend repeats file validation; frontend checks are not sufficient
    security.
4.  OCR service (Tesseract) extracts text.
5.  Extracted text is cleaned and normalized.
6.  If OCR is poor or no useful text is found, show a clear error and
    ask for a clearer image or pasted text.
7.  The common analysis pipeline begins.

**Upload safeguards:** - Accept only explicitly supported image
formats. - Enforce file-size and dimension limits. - Validate actual
file content, not only the filename extension. - Store uploads safely
and avoid exposing internal file paths. - Do not execute uploaded
content.

## 3.5 Common normalized job object

Regardless of input method, the extraction stage should produce a
consistent structure such as:

``` json
{
  "job_title": "Example role",
  "company_name": "Example company",
  "salary": "As stated in the posting",
  "location": "As stated in the posting",
  "description": "Extracted job description",
  "source_type": "text | url | screenshot"
}
```

Fields may be missing. Missing information should be represented clearly
rather than fabricated.

## 3.6 Job analysis pipeline

``` mermaid
flowchart TD
    A[Job Scanner Input] --> B{Input type}
    B -->|Pasted text| C[Validate text]
    B -->|URL| D[Validate and safely retrieve page]
    B -->|Screenshot| E[Validate image and run OCR]
    C --> F[Extract fields]
    D --> F
    E --> F
    F --> G[Normalize common job object]
    G --> H[Input quality and completeness checks]
    H --> I[Rule-based detection]
    I --> J[ML / NLP classification]
    J --> K[Company and domain verification signals]
    K --> L[Community pattern matching]
    L --> M[Risk engine]
    M --> N[Persist analysis and evidence]
    N --> O[Generate plain-language explanation]
    O --> P[Shared Results Page]
```

### Stage A --- Input quality checks

Check: - Is there enough text to analyze? - Is the content actually
job-related? - Are key fields available? - Did extraction or OCR
succeed? - Is the source supported?

If the input is incomplete, the system can still provide a limited
assessment where appropriate, but it must disclose the limitation.

### Stage B --- Rule-based detection

Look for signals such as: - Requests for upfront payment or deposits. -
Claims of guaranteed employment or guaranteed selection. - Unusually
urgent pressure to act. - Requests for unnecessary sensitive personal
information. - Inconsistent company, recruiter, or contact details. -
Suspicious communication patterns. - Implausible or contradictory job
details.

A single keyword must not automatically mark a posting as fraudulent.
Rules should be explainable and should consider context.

### Stage C --- ML / NLP analysis

A practical baseline: 1. Collect and inspect a labeled dataset. 2.
Remove duplicates and inspect missing values. 3. Preprocess text. 4.
Convert text into TF-IDF features. 5. Train a Logistic Regression
baseline. 6. Compare with other suitable models, such as Random Forest.
7. Evaluate with precision, recall, F1-score, and a confusion matrix. 8.
Keep training and test data separate. 9. Save the selected model and its
version.

Do not claim model performance without actually evaluating it on
appropriate held-out data.

### Stage D --- Company, domain, and external verification

Where reliable sources are available, check: - Whether the company has a
consistent official web presence. - Whether the job's company and domain
details are consistent. - Public company information, where supported. -
Trusted malicious-URL intelligence, where available. - Moderated
community reports and recurring patterns.

Store the source and time of each verification signal. Lack of available
information is not proof of fraud.

### Stage E --- Community pattern matching

Compare the submission against relevant, moderated reports and patterns.
Avoid presenting unverified community claims as established facts. Keep
the moderation status separate from the AI assessment.

### Stage F --- Risk engine

Combine available signals into a transparent risk index.

Important: - Do not simply average a model probability and a heuristic
score and call the result a fraud probability. - Until the score is
properly validated and calibrated, call it a **risk score** or **risk
index**. - Keep the contributing factors available for explanation. -
Record the model version and scoring-rule version used for the
analysis. - Distinguish missing evidence from evidence of safety.

### Stage G --- Save and explain

Persist: - Analysis record. - Scanner type and input source. -
Extracted/normalized data, as appropriate. - Risk factors and evidence
references. - Model and rule versions. - Processing status and
timestamps.

Then generate a clear explanation for the Results page.

------------------------------------------------------------------------

# 4. Shared Results Page

All scanner types should use one reusable Results page. The displayed
sections can change according to the scanner type, but the overall
layout should remain consistent.

## Suggested result layout

1.  **Overall assessment**
    -   Risk category.
    -   Risk index/score.
    -   Clear statement of what the assessment does and does not mean.
2.  **Warning signs detected**
    -   Each warning sign as a separate item.
    -   Severity or relevance where supported.
    -   Evidence from the submitted content.
3.  **Verification breakdown**
    -   Checks completed.
    -   Checks not available.
    -   Checks that could not be completed.
    -   Source and timestamp where relevant.
4.  **Why this result was produced**
    -   Plain-language explanation.
    -   Distinguish observed evidence from model inference.
5.  **Recommended next steps**
    -   Verify the company through its independently located official
        website.
    -   Contact the organization through independently verified contact
        details.
    -   Avoid paying fees to obtain a job.
    -   Be cautious about requests for unnecessary sensitive
        information.
    -   Seek further verification when information is incomplete.
6.  **Actions**
    -   Save job / result.
    -   Submit a community report.
    -   Download a report.
    -   Analyze another item.
    -   Return to dashboard.

Do not state that a job is legitimate solely because no warning signs
were detected.

------------------------------------------------------------------------

# 5. Other scanner flows

## 5.1 Message Analyzer

**Interface:** - Text area to paste a recruiter or employer message. -
Optional context field. - Analyze Message button.

**Flow:** 1. User pastes the message. 2. Frontend validates input. 3.
Backend stores or processes the submission according to the product's
data policy. 4. Rule engine checks communication-related signals. 5.
NLP/ML analysis evaluates the text. 6. Relevant company/recruiter
signals may be checked if details are supplied. 7. Risk engine creates
an assessment. 8. Shared Results page displays warning signs and
explanations.

## 5.2 Company Checker

**Interface:** - Company name. - Website/domain (optional if unknown). -
Other supported identifying details.

**Flow:** 1. User enters company details. 2. Backend normalizes the name
and domain. 3. Verification services check supported public sources. 4.
Community reports may be reviewed, with moderation status shown. 5.
System records what could and could not be verified. 6. Shared Results
page displays the evidence and limitations.

## 5.3 Recruiter Checker

**Interface:** - Recruiter name. - Company name. - Professional profile
or contact detail, if supported. - Optional message/context.

**Flow:** 1. User submits recruiter details. 2. Backend validates and
normalizes the information. 3. System checks consistency with the
claimed company and available public signals. 4. Message-related signals
may be included when context is provided. 5. Shared Results page
explains the findings and limitations.

## 5.4 URL Checker

**Interface:** - URL input. - Explanation of supported URLs. - Analyze
URL button.

**Flow:** 1. User enters a URL. 2. Backend validates and safely
retrieves the supported public page. 3. URL/domain signals and page
content are examined where available. 4. System records retrieval
limitations. 5. Shared Results page displays the assessment.

The same SSRF protections, redirect checks, timeouts, and response-size
limits used in the Job Scanner URL path must apply here.

------------------------------------------------------------------------

# 6. Analysis History, Saved Jobs, and Community Reports

## 6.1 Analysis History

**Interface:** Analysis History page

Show a list/table of the user's previous analyses, including: - Date and
time. - Scanner type. - Submitted item or short title. - Risk
category/index. - Processing status. - View result action.

Users should be able to open a previous result. New analyses should
create new history records rather than overwrite old ones.

## 6.2 Saved Jobs

**Interface:** Saved Jobs page

Show jobs/results that the user chose to save: - Job/company label. -
Saved date. - Risk category/index at the time of analysis. - Open
result. - Remove from saved list.

## 6.3 Community Reports

**Interface:** Community Reports page

Users can view community-submitted reports according to the product's
privacy and moderation policy.

**Submit Report flow:** 1. User opens Submit Report. 2. User enters the
relevant company/job/recruiter details. 3. User describes what happened.
4. User may attach permitted evidence. 5. User submits the report. 6.
Backend validates and stores it with a pending/moderation status. 7.
Moderators review it. 8. The report's moderation state is updated. 9.
Only appropriately moderated information is surfaced as a community
signal.

Community reports should not be treated as verified facts before
moderation.

------------------------------------------------------------------------

# 7. Profile, settings, and admin interfaces

## 7.1 Profile & Settings

Possible sections: - Basic profile information. - Account settings. -
Password change. - Privacy/data controls, if implemented. - Logout.

## 7.2 Admin Dashboard

Admin-only interface showing platform-level summaries: - Total users. -
Total analyses. - Scanner usage. - Report counts by moderation status. -
Analysis trends. - Operational/error summaries, if implemented.

## 7.3 Admin Moderation

Admin/moderator interface: - List of pending reports. - Report details
and submitted evidence. - Review status. - Approve, reject, or request
changes where supported. - Moderation notes and audit history.

Keep moderation decisions separate from AI-generated risk categories.

## 7.4 Admin Analytics

Charts and tables can show: - Analyses over time. - Usage by scanner
type. - Report moderation trends. - Common categories of reported
warning signs.

Avoid exposing personal user data unnecessarily.

------------------------------------------------------------------------

# 8. Complete page inventory

The planned platform has 22 pages/interfaces. Some may share components
or layouts.

    No. Area     Page
  ----- -------- -------------------------
      1 Public   Landing
      2 Public   About
      3 Public   How It Works
      4 Public   Features
      5 Auth     Register
      6 Auth     Login
      7 Auth     Forgot Password
      8 User     Dashboard
      9 User     Job Scanner
     10 User     Message Analyzer
     11 User     Company Checker
     12 User     Recruiter Checker
     13 User     URL Checker
     14 User     Shared Analysis Results
     15 User     Community Reports
     16 User     Submit Report
     17 User     Analysis History
     18 User     Saved Jobs
     19 User     Profile & Settings
     20 Admin    Admin Dashboard
     21 Admin    Admin Moderation
     22 Admin    Admin Analytics

------------------------------------------------------------------------

# 9. Technical architecture

## 9.1 Recommended technology stack

  Layer                 Technology
  --------------------- ---------------------
  Frontend              React.js + Vite
  Styling               Tailwind CSS
  Routing               React Router
  API requests          Axios
  Backend               Python FastAPI
  Database              PostgreSQL
  ORM                   SQLAlchemy
  Database migrations   Alembic
  Authentication        JWT
  Password hashing      Argon2 or bcrypt
  ML/NLP                Scikit-learn, spaCy
  Screenshot OCR        Tesseract
  Charts                Recharts
  PDF report            ReportLab
  Frontend hosting      Vercel
  Backend hosting       Render

## 9.2 Architecture diagram

``` mermaid
flowchart LR
    U[User Browser] --> FE[React + Vite + Tailwind]
    FE -->|HTTPS / JSON API| API[FastAPI Backend]
    API --> AUTH[Authentication and Authorization]
    API --> SVC[Scanner Services]
    SVC --> EXT[Text / URL / OCR Extraction]
    SVC --> AI[AI and Rule Engine]
    AI --> VERIFY[Verification and Community Signals]
    AI --> RISK[Risk Engine and Explanation]
    API --> DB[(PostgreSQL)]
    SVC --> FILES[Secure File Storage]
    RISK --> DB
    API --> FE
```

## 9.3 Frontend responsibilities

-   Render public, authentication, user, and admin pages.
-   Handle form state and client-side validation.
-   Protect authenticated routes in the UI.
-   Send API requests.
-   Display loading, success, and error states.
-   Display analysis results and history.
-   Keep layouts responsive.

Frontend route protection is not a security boundary by itself. The
backend must independently authenticate and authorize every protected
API request.

## 9.4 Backend responsibilities

-   Authentication and authorization.
-   Input validation.
-   Scanner orchestration.
-   Extraction and normalization.
-   Rule-based and ML analysis.
-   Verification integrations.
-   Risk scoring and explanation.
-   Database persistence.
-   Report moderation.
-   Admin analytics.
-   Consistent error responses.

## 9.5 Database responsibilities

-   Store users and roles.
-   Store company, recruiter, and job information where needed.
-   Store analysis runs and scanner-specific detail.
-   Store risk factors and evidence references.
-   Store saved jobs and community reports.
-   Maintain moderation logs.
-   Preserve historical analyses.

------------------------------------------------------------------------

# 10. Database design

## 10.1 Recommended tables

-   `users`
-   `companies`
-   `recruiters`
-   `job_postings`
-   `analysis_runs`
-   `job_analysis_details`
-   `message_analysis_details`
-   `company_analysis_details`
-   `recruiter_analysis_details`
-   `url_analysis_details`
-   `risk_factors`
-   `scam_reports`
-   `report_evidence`
-   `saved_jobs`
-   `moderation_logs`
-   `notifications`

## 10.2 Why use a central `analysis_runs` table?

Every scanner creates an analysis, but the input details differ. A
central table stores fields common to every analysis, while one optional
detail table stores scanner-specific information.

For example: - A job analysis has job-related details. - A message
analysis has message-related details. - A company analysis has
company-related details. - A recruiter analysis has recruiter-related
details. - A URL analysis has URL-related details.

This avoids creating completely separate history systems for each
scanner.

## 10.3 Main relationships

``` mermaid
erDiagram
    USERS ||--o{ ANALYSIS_RUNS : creates
    USERS ||--o{ SCAM_REPORTS : submits
    USERS ||--o{ SAVED_JOBS : saves
    ANALYSIS_RUNS ||--o| JOB_ANALYSIS_DETAILS : has
    ANALYSIS_RUNS ||--o| MESSAGE_ANALYSIS_DETAILS : has
    ANALYSIS_RUNS ||--o| COMPANY_ANALYSIS_DETAILS : has
    ANALYSIS_RUNS ||--o| RECRUITER_ANALYSIS_DETAILS : has
    ANALYSIS_RUNS ||--o| URL_ANALYSIS_DETAILS : has
    ANALYSIS_RUNS ||--o{ RISK_FACTORS : contains
    COMPANIES ||--o{ JOB_POSTINGS : lists
    COMPANIES ||--o{ RECRUITERS : employs_or_claims
    JOB_POSTINGS ||--o{ SAVED_JOBS : saved_as
    JOB_POSTINGS ||--o{ SCAM_REPORTS : referenced_by
    SCAM_REPORTS ||--o{ REPORT_EVIDENCE : includes
    SCAM_REPORTS ||--o{ MODERATION_LOGS : reviewed_in
```

## 10.4 Database implementation rules

-   Use UUIDs for major records.
-   Enforce unique user emails.
-   Use foreign-key constraints.
-   Index company names/domains and analysis dates where useful.
-   Preserve old analyses; do not overwrite history.
-   Store uploaded evidence in secure file storage and store
    references/metadata in PostgreSQL.
-   Keep moderation status separate from AI risk classification.
-   Record model version and scoring-rule version.
-   Use migrations rather than manually changing production schemas.

## 10.5 Analysis transaction sequence

A typical analysis should follow this logical sequence:

1.  Create a central `analysis_runs` record with a processing status.
2.  Store the normalized input or relevant reference.
3.  Create the appropriate scanner-specific detail record.
4.  Run checks and create `risk_factors` records.
5.  Store the final risk index/category and explanation metadata.
6.  Update the analysis status to completed or failed.
7.  Return the analysis ID and result to the frontend.

For long-running OCR or URL jobs, return a processing ID and let the
frontend poll a status endpoint or use another explicitly implemented
job-status mechanism.

------------------------------------------------------------------------

# 11. API endpoint plan

A consistent API prefix is recommended: `/api/v1`.

## Authentication and user

  Method   Endpoint                  Purpose
  -------- ------------------------- --------------------
  POST     `/api/v1/auth/register`   Create account
  POST     `/api/v1/auth/login`      Authenticate user
  GET      `/api/v1/users/me`        Get current user
  GET      `/api/v1/dashboard`       Get dashboard data

## Analyses

  Method   Endpoint                        Purpose
  -------- ------------------------------- ----------------------
  POST     `/api/v1/analyses/jobs`         Analyze a job
  POST     `/api/v1/analyses/messages`     Analyze a message
  POST     `/api/v1/analyses/companies`    Check a company
  POST     `/api/v1/analyses/recruiters`   Check a recruiter
  POST     `/api/v1/analyses/urls`         Check a URL
  GET      `/api/v1/analyses/{id}`         Get one analysis
  GET      `/api/v1/analyses`              List user's analyses

The job endpoint should accept one of the supported input methods:
pasted text, URL, or screenshot upload. The exact request schema should
make the selected input type explicit.

## Saved jobs and reports

  Method   Endpoint               Purpose
  -------- ---------------------- ----------------------------------
  POST     `/api/v1/saved-jobs`   Save a job/result
  POST     `/api/v1/reports`      Submit a community report
  GET      `/api/v1/reports`      List permitted community reports

## Admin

  Method   Endpoint                       Purpose
  -------- ------------------------------ --------------------------
  PATCH    `/api/v1/admin/reports/{id}`   Update moderation status
  GET      `/api/v1/admin/analytics`      Get admin analytics

## Standard response envelope

Successful response example:

``` json
{
  "success": true,
  "data": {
    "analysis_id": "example-id",
    "status": "completed"
  },
  "message": "Analysis completed"
}
```

Errors should use a consistent structure, meaningful HTTP status codes,
and safe user-facing messages. Do not expose stack traces or secrets.

------------------------------------------------------------------------

# 12. Frontend implementation structure

## 12.1 Suggested folder structure

``` text
frontend/
└── src/
    ├── assets/
    ├── components/
    │   ├── Navbar.jsx
    │   ├── Sidebar.jsx
    │   ├── RiskBadge.jsx
    │   ├── RiskMeter.jsx
    │   ├── UploadBox.jsx
    │   ├── TextInput.jsx
    │   ├── AnalysisCard.jsx
    │   ├── ResultSection.jsx
    │   ├── LoadingState.jsx
    │   └── ProtectedRoute.jsx
    ├── pages/
    │   ├── public/
    │   ├── auth/
    │   ├── dashboard/
    │   └── admin/
    ├── layouts/
    │   ├── PublicLayout.jsx
    │   ├── AuthLayout.jsx
    │   ├── DashboardLayout.jsx
    │   └── AdminLayout.jsx
    ├── context/
    │   └── AuthContext.jsx
    ├── services/
    │   └── api.js
    ├── App.jsx
    └── main.jsx
```

## 12.2 Reusable components

-   `Navbar`: public navigation.
-   `Sidebar`: authenticated navigation.
-   `RiskBadge`: consistent risk label.
-   `RiskMeter`: visual risk index.
-   `UploadBox`: screenshot upload UI.
-   `TextInput`: reusable text input.
-   `AnalysisCard`: analysis preview.
-   `ResultSection`: shared results content.
-   `LoadingState`: processing state.
-   `ProtectedRoute`: frontend route guard.

Use layouts to keep public, auth, dashboard, and admin experiences
consistent.

------------------------------------------------------------------------

# 13. Backend implementation structure

``` text
backend/
└── app/
    ├── core/
    │   ├── config.py
    │   └── security.py
    ├── database/
    │   ├── connection.py
    │   └── base.py
    ├── models/
    ├── schemas/
    ├── routes/
    ├── services/
    ├── ai_engine/
    │   ├── preprocessing.py
    │   ├── rules.py
    │   ├── classifier.py
    │   ├── risk_engine.py
    │   └── explanations.py
    ├── utils/
    └── main.py
├── migrations/
├── tests/
├── requirements.txt
└── .env
```

Keep secrets in environment variables. Do not commit `.env` files or API
keys to GitHub.

------------------------------------------------------------------------

# 14. Team division

## Four-person team

  -----------------------------------------------------------------------
  Member                  Main ownership          Deliverables
  ----------------------- ----------------------- -----------------------
  1                       Frontend                Landing page, auth UI,
                                                  dashboard, scanner
                                                  forms, results UI,
                                                  responsive design

  2                       Backend                 FastAPI setup,
                                                  authentication, APIs,
                                                  business logic,
                                                  integration

  3                       AI/ML                   Dataset preparation,
                                                  preprocessing, rule
                                                  engine, model
                                                  training/evaluation,
                                                  scoring and
                                                  explanations

  4                       Database and            ER design, PostgreSQL,
                          integration             SQLAlchemy, migrations,
                                                  history/reports,
                                                  integration testing
  -----------------------------------------------------------------------

## Three-person team

-   Person 1: Frontend.
-   Person 2: Backend + database.
-   Person 3: AI/ML + integration support.

## Two-person team

-   Person 1: Frontend + database design/UI data integration.
-   Person 2: Backend + AI pipeline.

Keep ownership clear, agree on API contracts early, and integrate
continuously rather than waiting until the end.

------------------------------------------------------------------------

# 15. GitHub collaboration workflow

Suggested branches: - `main` - `frontend` - `backend` - `database` -
`ai-engine` - `integration`

Workflow: 1. Keep `main` stable. 2. Create feature branches for tasks.
3. Commit small, meaningful changes. 4. Push branches regularly. 5. Open
pull requests for review. 6. Test integrations before merging. 7. Use
GitHub Issues to assign tasks and track blockers.

Agree on file ownership and API request/response contracts to reduce
merge conflicts.

------------------------------------------------------------------------

# 16. Development roadmap --- milestone by milestone

## Milestone 1 --- Project setup

-   Create GitHub repository.
-   Set up React + Vite frontend.
-   Set up FastAPI backend.
-   Configure PostgreSQL.
-   Create environment configuration.
-   Confirm frontend can call backend.

## Milestone 2 --- Database foundation

-   Finalize ER diagram.
-   Create SQLAlchemy models.
-   Configure database connection.
-   Set up Alembic migrations.
-   Test basic create/read operations.

## Milestone 3 --- Authentication

-   Register endpoint and page.
-   Login endpoint and page.
-   Password hashing.
-   JWT/session handling.
-   Protected frontend routes.
-   Backend authorization checks.
-   Redirect to intended scanner after login.

## Milestone 4 --- Frontend foundation

-   Landing page.
-   Public navigation.
-   Login/register pages.
-   Dashboard layout.
-   Sidebar and reusable components.
-   Loading, empty, success, and error states.

## Milestone 5 --- Job Scanner

-   Build three input methods.
-   Add text validation.
-   Add safe URL extraction.
-   Add screenshot upload validation.
-   Integrate OCR.
-   Normalize all input methods into one common structure.
-   Connect the scanner to the backend API.

## Milestone 6 --- AI engine

-   Build first rule-based checks.
-   Prepare and inspect dataset.
-   Train a baseline ML model.
-   Evaluate model performance.
-   Build transparent risk index.
-   Generate explanations and evidence references.
-   Record model and rule versions.

## Milestone 7 --- Results and history

-   Build reusable Results page.
-   Persist analysis results.
-   Display risk factors and verification breakdown.
-   Build Analysis History.
-   Build Saved Jobs.
-   Add PDF report generation if time permits.

## Milestone 8 --- Additional scanners

-   Message Analyzer.
-   Company Checker.
-   Recruiter Checker.
-   URL Checker.
-   Reuse the central analysis and results architecture.

## Milestone 9 --- Community and admin

-   Community report submission.
-   Evidence references.
-   Moderation workflow.
-   Admin dashboard.
-   Admin analytics.

## Milestone 10 --- Testing and deployment

-   Test all user journeys.
-   Test authorization and security.
-   Fix integration bugs.
-   Deploy frontend and backend.
-   Configure production database and environment variables.
-   Run final end-to-end demo.

## Dependency order

``` mermaid
flowchart TD
    A[Project setup] --> B[Database schema]
    A --> C[Frontend wireframes]
    B --> D[Database models and migrations]
    C --> E[Reusable React components]
    D --> F[Authentication APIs]
    E --> G[Auth and dashboard UI]
    F --> H[Protected dashboard]
    G --> H
    H --> I[Analysis APIs and AI integration]
    I --> J[Job Scanner]
    J --> K[Results and history]
    K --> L[Other scanners]
    L --> M[Community and admin]
    M --> N[Testing]
    N --> O[Deployment and demo]
```

Database foundation and frontend wireframes can proceed in parallel
after project setup. Integration should begin early.

------------------------------------------------------------------------

# 17. Testing checklist

## Authentication and access

-   [ ] Registration with valid details.
-   [ ] Duplicate email is rejected.
-   [ ] Invalid login is rejected.
-   [ ] Passwords are never stored in plaintext.
-   [ ] Logged-out visitor trying to use a scanner is redirected to
    login.
-   [ ] After login, user returns to the intended scanner.
-   [ ] A normal user cannot access admin APIs.

## Scanner inputs

-   [ ] Valid pasted job description.
-   [ ] Empty job description.
-   [ ] Very long input.
-   [ ] Unsupported URL.
-   [ ] URL retrieval failure.
-   [ ] Screenshot with readable text.
-   [ ] Invalid or unsupported upload.
-   [ ] Screenshot where OCR cannot extract useful text.
-   [ ] Failed extraction is not incorrectly labelled as fraud.

## AI and results

-   [ ] Suspicious upfront-payment request is flagged as a warning sign.
-   [ ] Genuine-looking job without sufficient evidence is not falsely
    accused.
-   [ ] A single keyword does not automatically determine the result.
-   [ ] Result explains the signals used.
-   [ ] Missing verification information is disclosed.
-   [ ] Model test data is separate from training data.
-   [ ] Model and rule versions are recorded.
-   [ ] Failed AI processing produces a graceful error and a recorded
    status.

## Community and admin

-   [ ] Duplicate or repeated reports are handled appropriately.
-   [ ] New reports receive a pending moderation state.
-   [ ] Moderation changes are logged.
-   [ ] Unmoderated claims are not presented as verified facts.
-   [ ] Only authorized admins can moderate reports.

------------------------------------------------------------------------

# 18. Security, privacy, and reliability checklist

-   Enforce authentication and authorization on the backend.
-   Hash passwords with Argon2 or bcrypt.
-   Validate all incoming data on the server.
-   Apply upload type, size, and content checks.
-   Store uploads safely.
-   Prevent SSRF in URL retrieval.
-   Re-check redirect destinations.
-   Apply request timeouts and response-size limits.
-   Keep secrets in environment variables.
-   Avoid exposing stack traces or internal paths.
-   Limit access to personal data.
-   Define data retention and deletion behavior before launch.
-   Log important security and moderation events without unnecessarily
    logging sensitive content.
-   Handle external verification outages and AI failures gracefully.

------------------------------------------------------------------------

# 19. Visual design direction

The user wants VERITORA's website colour theme to be based on the
attached Figma reference:

**Bean Scene Coffee Landingpage**\
Figma Community reference:
https://www.figma.com/community/file/1201418433329014860/bean-scene-coffee-landingpage

Apply this reference when designing: - Page backgrounds and surfaces. -
Primary and secondary colours. - Buttons and links. - Cards and
panels. - Navigation and footer. - Typography and overall visual
consistency.

**Reference limitation:** The attachment available during planning was
an HTML snapshot of the Figma Community page, not the actual editable
design canvas. Exact colour values have not yet been verified. Use a
screenshot or actual design canvas to sample the palette before
finalizing design tokens. Do not invent exact hex codes and claim they
came from the reference.

The reference is for visual direction; VERITORA's information
architecture and content should remain appropriate to a
recruitment-safety platform.

------------------------------------------------------------------------

# 20. Immediate next steps

Recommended order for starting implementation:

1.  Confirm the visual identity and inspect the Figma reference
    screenshot for exact colours.
2.  Finalize the ER diagram and database field definitions.
3.  Create the GitHub repository and project folder structure.
4.  Sketch the Landing Page and Dashboard wireframes.
5.  Define the first Job Scanner API contract, including request fields,
    response shape, statuses, and error cases.
6.  Build the authentication flow.
7.  Connect the first scanner end to end, initially with transparent
    rule-based checks.
8.  Add ML and external verification only when the data and evaluation
    support them.

## First working demo target

A realistic first end-to-end demo should be:

1.  Visitor opens Landing Page.
2.  Visitor clicks **Scan a Job**.
3.  Visitor is redirected to Login/Register.
4.  User logs in and lands on the Job Scanner.
5.  User pastes a job description.
6.  Backend validates and normalizes it.
7.  Initial rule checks run.
8.  Analysis is saved in PostgreSQL.
9.  Shared Results page displays the assessment and reasons.
10. User can open the analysis again from History.

After this vertical slice works, add URL and screenshot inputs, then the
other scanners and community/admin features.

------------------------------------------------------------------------

## 21. Key design principles to preserve

1.  **One consistent journey:** Public exploration → authentication →
    dashboard → scanner → analysis → shared results.
2.  **One shared analysis architecture:** Different scanner inputs
    should reuse common processing and result structures where possible.
3.  **Explainability:** Show why a warning was raised.
4.  **Honest uncertainty:** Do not confuse missing data with proof of
    safety or fraud.
5.  **Security by design:** Validate inputs and enforce access on the
    backend.
6.  **Historical traceability:** Preserve analyses, evidence references,
    and model/rule versions.
7.  **Moderation discipline:** Community reports remain distinct from
    verified evidence and AI assessment.
8.  **Incremental delivery:** Complete one working end-to-end flow
    before expanding every feature.

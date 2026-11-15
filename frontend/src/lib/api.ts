export type ApiError = {
  type?: string
  title?: string
  status: number
  detail?: string
  code?: string
  request_id?: string
}

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
const BASE_URL = (rawBaseUrl && rawBaseUrl.replace(/\/$/, '')) || '/api/v1'

let accessToken: string | null = null
export function setAccessToken(token: string | null) {
  accessToken = token
}
export function getAccessToken() {
  return accessToken
}

export class HttpError extends Error {
  status: number
  problem?: ApiError
  constructor(message: string, status: number, problem?: ApiError) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.problem = problem
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  // Defense-in-depth for cookie-authenticated endpoints (e.g. refresh/logout)
  if (!headers.has('X-Requested-With')) headers.set('X-Requested-With', 'XMLHttpRequest')

  const res = await fetch(`${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    credentials: 'include',
    ...init,
    headers,
  })

  const text = await res.text()
  let data: unknown = null
  try {
    data = text ? (JSON.parse(text) as unknown) : null
  } catch {
    data = text
  }

  if (!res.ok) {
    const problem = data && typeof data === 'object' ? (data as ApiError) : undefined
    throw new HttpError(problem?.title || 'Request failed', res.status, problem)
  }
  return data as T
}

export type User = {
  id: string
  email: string
  name?: string
  role: 'user' | 'moderator' | 'admin'
  preferred_language?: 'en' | 'hi'
  explanation_language?: 'en' | 'hi'
  theme?: 'light' | 'dark' | 'system'
}

export type AuthResponse = { access_token?: string; user: User }

export function register(payload: { name: string; email: string; password: string }) {
  return apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(payload) })
}
export function login(payload: { email: string; password: string }) {
  return apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(payload) })
}
export function refresh() {
  return apiFetch<AuthResponse>('/auth/refresh', { method: 'POST' })
}
export function logout() {
  return apiFetch<void>('/auth/logout', { method: 'POST' })
}
export function getMe() {
  return apiFetch<User>('/me')
}
export function patchMe(payload: Partial<Pick<User, 'name' | 'preferred_language' | 'explanation_language' | 'theme'>>) {
  return apiFetch<User>('/me', { method: 'PATCH', body: JSON.stringify(payload) })
}
export function deleteMe() {
  return apiFetch<void>('/me', { method: 'DELETE' })
}
export function getDashboard() {
  return apiFetch<Record<string, unknown>>('/dashboard')
}

export function listAnalyses() {
  return apiFetch<{ items: AnalysisResult[]; next_cursor: string | null }>('/analyses')
}

export function refreshAnalysis(id: string) {
  return apiFetch<AnalysisResult>(`/analyses/${encodeURIComponent(id)}/refresh`, { method: 'POST' })
}

export type SavedOpportunity = {
  id: string
  analysis_id?: string | null
  title?: string | null
  notes?: string | null
}

export function listSaved() {
  return apiFetch<{ items: SavedOpportunity[]; next_cursor: string | null }>('/saved')
}

export function createSaved(payload: { analysis_id?: string; title?: string; notes?: string }) {
  return apiFetch<SavedOpportunity>('/saved', { method: 'POST', body: JSON.stringify(payload) })
}

export type ChecklistItem = { item_key: string; completed: boolean; meta?: Record<string, unknown> | null }

export function getChecklist() {
  return apiFetch<{ items: ChecklistItem[] }>('/checklist')
}

export function updateChecklist(payload: { item_key: string; completed: boolean; meta?: Record<string, unknown> }) {
  return apiFetch<ChecklistItem>('/checklist', { method: 'POST', body: JSON.stringify(payload) })
}

export type DataExposureItem = {
  item: string
  category: string
  categories: string[]
  matched_as?: string | null
  necessity_by_stage?: string | null
  why_may_be_unnecessary?: string | null
  safer_alternative?: string | null
  necessity: Record<string, string>
  warning?: string | null
  safer_alternatives: string[]
}

export function checkDataExposure(payload: { items?: string[]; text?: string }) {
  return apiFetch<{
    items: DataExposureItem[]
    has_high_risk: boolean
    hard_warning_message?: string | null
    guidance: string[]
  }>('/data-exposure/check', { method: 'POST', body: JSON.stringify(payload) })
}

export type CyberResource = {
  id: string
  type: 'portal' | 'phone' | 'website' | 'email'
  label: string
  url?: string
  tel?: string
  href?: string
  email?: string
  primary?: boolean
}

export type CyberResourcesResponse = {
  country: string
  disclaimer_key: string
  reviewed_at?: string
  resources: CyberResource[]
}

export const fallbackCyberResources: CyberResourcesResponse = {
  country: 'IN',
  disclaimer_key: 'cyber.not_official_portal',
  resources: [
    { id: 'ncrp', type: 'portal', label: 'National Cyber Crime Reporting Portal', url: 'https://cybercrime.gov.in/', primary: true },
    { id: 'helpline_1930', type: 'phone', label: 'Cybercrime helpline (financial cyber fraud)', tel: '1930', href: 'tel:1930', primary: true },
    { id: 'certin', type: 'website', label: 'CERT-In', url: 'https://www.cert-in.org.in/' },
    { id: 'certin_contact', type: 'website', label: 'CERT-In incident response contact', url: 'https://www.cert-in.org.in/s2cMainServlet?pageid=CONTACTUS' },
    { id: 'certin_email', type: 'email', label: 'CERT-In incident email', email: 'incident@cert-in.org.in' },
    { id: 'certin_tollfree', type: 'phone', label: 'CERT-In toll-free', tel: '1800-11-4949' },
  ],
}

export function getCyberResources() {
  return apiFetch<CyberResourcesResponse>('/resources/cybercrime')
}

// --- Chat (grounded verification assistant) --------------------------------

export type ChatStatementType = 'fact' | 'user_report' | 'ai_interpretation'

export type ChatMessage = {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  citations: string[]
  statement_types: ChatStatementType[]
  mode?: 'templated' | 'llm' | null
  created_at?: string | null
}

export type ChatSession = {
  id: string
  analysis_id?: string | null
  title?: string | null
  created_at?: string | null
}

export type ChatPostResult = {
  session_id: string
  stored: boolean
  warning?: string | null
  injection_detected: boolean
  user_message: ChatMessage | null
  assistant_message: ChatMessage
}

export function createChatSession(payload: { analysis_id?: string; title?: string } = {}) {
  return apiFetch<ChatSession>('/chat/sessions', { method: 'POST', body: JSON.stringify(payload) })
}

export function listChatSessions() {
  return apiFetch<{ items: ChatSession[] }>('/chat/sessions')
}

export function getChatSession(id: string) {
  return apiFetch<ChatSession & { messages: ChatMessage[] }>(`/chat/sessions/${encodeURIComponent(id)}`)
}

export function postChatMessage(sessionId: string, message: string) {
  return apiFetch<ChatPostResult>(`/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export type JobAnalyzeRequest = {
  title: string
  description: string
  company_name?: string
  salary_text?: string
  experience_level?: string
  location?: string
  application_instructions?: string
  recruiter_contact?: string
  company_website?: string
  explanation_language?: 'en' | 'hi'
}

export type RiskFactor = {
  code: string
  severity?: string
  confidence?: string
  evidence?: { excerpt?: string | null; span?: { start: number; end: number } | null }
  source?: { type?: string }
  explanation?: string
  explanation_original?: string
  evidence_key?: string
  translation?: { uncertain?: boolean; note?: string | null; confidence?: string }
}

export type AnalysisResult = {
  id: string
  assessment_type?: string
  rules_version?: string
  risk_score?: number | null
  risk_band: 'lower' | 'moderate' | 'high_concern' | 'very_high_concern' | 'insufficient_information'
  summary?: string | null
  risk_factors?: RiskFactor[]
  verification?: Array<Record<string, unknown>>
  unknowns?: string[]
  missing_information?: string[]
  recommendations?: Array<{ code?: string; priority?: number; text_key?: string; text?: string; text_original?: string; translation?: { uncertain?: boolean; note?: string | null; confidence?: string } }>
  community?: Record<string, unknown>
  disclaimer_key?: string
  disclaimer?: { text?: string; text_original?: string; uncertain?: boolean }
  explanation_language?: string
  created_at?: string
  notes?: string[]
  supersedes_id?: string | null
}

export function analyzeJob(payload: JobAnalyzeRequest) {
  return apiFetch<AnalysisResult>('/analyze/job', { method: 'POST', body: JSON.stringify(payload) })
}

export function getAnalysis(id: string) {
  return apiFetch<AnalysisResult>(`/analyses/${encodeURIComponent(id)}`)
}

export type VerifyCompanyRequest = {
  company_name: string
  website?: string
  email_domain?: string
  registration_id?: string
}

export type VerificationCheck = {
  check_type: string
  status: 'information_found' | 'consistent' | 'mismatch' | 'inconclusive' | 'not_checked'
  matched_fields: string[]
  mismatched_fields: string[]
  unknown_fields: string[]
  source_url?: string | null
  checked_at?: string | null
  details?: Record<string, unknown>
}

export type VerifyCompanyResponse = {
  company_id?: string
  checks: VerificationCheck[]
  community?: { approved_report_count?: number; labels?: string[]; note?: string }
  overall_status: 'information_found' | 'consistent' | 'mismatch' | 'inconclusive' | 'not_checked'
  checked_at?: string
}

export function verifyCompany(payload: VerifyCompanyRequest) {
  return apiFetch<VerifyCompanyResponse>('/verify/company', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type VerifyRecruiterRequest = {
  recruiter_name: string
  claimed_company: string
  claimed_role?: string
  email?: string
  profile_url?: string
  company_website?: string
}

export type VerifyRecruiterResponse = {
  recruiter_name: string
  claimed_role?: string | null
  claimed_company: string
  checks: VerificationCheck[]
  evidence: Array<Record<string, unknown>>
  mismatches: string[]
  unknowns: string[]
  overall_status: string
  safe_next_step: string
  checked_at: string
}

export function verifyRecruiter(payload: VerifyRecruiterRequest) {
  return apiFetch<VerifyRecruiterResponse>('/verify/recruiter', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function scanUrl(payload: { url: string }) {
  return apiFetch<Record<string, unknown>>('/scan/url', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function analyzeMessage(payload: { messages: Array<{ sender: string; text: string }> }) {
  return apiFetch<AnalysisResult>('/analyze/message', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type ReportCategory =
  | 'payment_request'
  | 'impersonation_concern'
  | 'suspicious_link'
  | 'fake_offer_concern'
  | 'data_request'
  | 'misleading_job_details'
  | 'other'

export type ReportCreatePayload = {
  company_name: string
  job_title?: string
  job_url?: string
  recruiter_identifier?: string
  category: ReportCategory
  description: string
  occurred_on?: string
  interacted?: boolean
  paid?: boolean
  shared_info?: boolean
}

export type ReportPublic = {
  id: string
  company: string
  category: string
  public_summary: string | null
  moderation_status: string
  occurred_on_approx: string | null
  label: string
}

export type CreateReportResponse = {
  id: string
  moderation_status: string
  pii_warnings: string[]
}

export function listPublicReports(company?: string) {
  const q = company ? `?company=${encodeURIComponent(company)}` : ''
  return apiFetch<{ items: ReportPublic[]; next_cursor: string | null }>(`/reports${q}`)
}

export function createReport(payload: ReportCreatePayload) {
  return apiFetch<CreateReportResponse>('/reports', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type AdminReport = {
  id: string
  company_name: string
  job_title?: string | null
  job_url?: string | null
  recruiter_identifier?: string | null
  category: string
  description: string
  occurred_on?: string | null
  interacted?: boolean | null
  paid?: boolean | null
  shared_info?: boolean | null
  moderation_status: string
  public_summary?: string | null
  pii_flagged?: boolean
  created_at?: string | null
  user_id?: string
}

export type ModerationActionType = 'approve' | 'reject' | 'mark_inconclusive' | 'request_evidence' | 'remove' | 'redact'

export function adminListReports(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : ''
  return apiFetch<{ items: AdminReport[]; next_cursor: string | null }>(`/admin/reports${q}`)
}

export function adminModerateReport(
  reportId: string,
  payload: { action: ModerationActionType; reason: string; public_summary?: string; private_note?: string },
) {
  return apiFetch<AdminReport>(`/admin/reports/${encodeURIComponent(reportId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export type AdminAppeal = {
  id: string
  report_id: string
  message?: string | null
  submitted_at?: string | null
  report?: AdminReport | null
}

export function adminListAppeals() {
  return apiFetch<{ items: AdminAppeal[]; next_cursor: string | null }>('/admin/appeals')
}

export type AdminAuditLogItem = {
  id: string
  actor_id?: string | null
  action?: string | null
  resource_type?: string | null
  resource_id?: string | null
  timestamp?: string | null
  request_id?: string | null
}

export function adminListAuditLogs(params?: { limit?: number; cursor?: string | null; action?: string; resource_type?: string }) {
  const sp = new URLSearchParams()
  if (params?.limit) sp.set('limit', String(params.limit))
  if (params?.cursor) sp.set('cursor', params.cursor)
  if (params?.action) sp.set('action', params.action)
  if (params?.resource_type) sp.set('resource_type', params.resource_type)
  const q = sp.toString()
  return apiFetch<{ items: AdminAuditLogItem[]; next_cursor: string | null }>(`/admin/audit-logs${q ? `?${q}` : ''}`)
}

export type TrendPoint = { week_start: string; count: number }

export type RisingCategory = {
  category: string
  previous_count: number
  current_count: number
  delta: number
}

export type TrendResponse = {
  window_weeks: number
  week_start: string
  generated_at: string
  approved_report_total: number
  weekly: TrendPoint[]
  total_by_category: Record<string, number>
  rising_categories: RisingCategory[]
  notes: string[]
}

export function getAdminTrends(weeks = 8) {
  return apiFetch<TrendResponse>(`/admin/analytics/trends?weeks=${encodeURIComponent(String(weeks))}`)
}

export type NetworkAlert = {
  relationship_id: string | null
  relationship_type: string
  confidence?: number | null
  review_status?: string | null
  evidence?: {
    kind?: string | null
    similarity?: number | null
    detail?: Record<string, unknown>
    record_refs?: Record<string, unknown>
  }
  entities?: Array<{ id?: string | null; entity_ref_hash?: string }>
}

export function getAdminNetworkAlerts() {
  return apiFetch<{ items: NetworkAlert[]; notice?: string }>('/admin/network/alerts')
}

export function searchNetwork(q?: string) {
  const qs = q ? `?q=${encodeURIComponent(q)}` : ''
  return apiFetch<{ items: NetworkAlert[]; notice?: string }>(`/network/search${qs}`)
}

export type WatchlistEntryItem = {
  id: string
  entity_reference: string
  status: 'unverified_signal' | 'under_review' | 'confirmed_pattern' | 'cleared' | string
  reason?: string | null
  evidence_reference?: string | null
  source?: string | null
  confidence?: number | null
  reviewer_id?: string | null
  reviewed_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export function adminListWatchlist() {
  return apiFetch<{ items: WatchlistEntryItem[]; next_cursor: string | null }>('/admin/watchlist')
}

export function adminCreateWatchlist(payload: {
  entity_reference: string
  status?: string
  reason?: string
  evidence_reference?: string
  source?: string
  confidence?: number
}) {
  return apiFetch<WatchlistEntryItem>('/admin/watchlist', { method: 'POST', body: JSON.stringify(payload) })
}

export function adminUpdateWatchlist(id: string, payload: Partial<WatchlistEntryItem> & { status?: string }) {
  return apiFetch<WatchlistEntryItem>(`/admin/watchlist/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function getPublicWatchlistStatus(entityReference: string) {
  return apiFetch<{ items: Array<{ entity_reference: string; flag: string }> }>(
    `/watchlist/status?entity_reference=${encodeURIComponent(entityReference)}`,
  )
}

export type PassportSnapshot = {
  passport_id?: string
  assessment_type?: string
  rules_version?: string
  risk_score?: number | null
  risk_band?: string
  summary?: string | null
  risk_factors?: Array<Record<string, unknown>>
  checks?: Array<Record<string, unknown>>
  checks_performed_and_not_performed?: Array<Record<string, unknown>>
  unknowns?: string[]
  missing_information?: string[]
  recommendations?: Array<Record<string, unknown>>
  community?: Record<string, unknown>
  disclaimer_key?: string
  analysis_created_at?: string | null
  refresh_guidance?: string
  no_personal_data?: boolean
  expires_at?: string | null
  created_at?: string | null
  revoked?: boolean
}

export function createPassport(payload: { analysis_id: string; expires_in_days?: number }) {
  return apiFetch<{ id: string; analysis_id: string; token: string; expires_at?: string; created_at?: string; note?: string }>(
    '/passports',
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

export function getPassportPublic(token: string) {
  return apiFetch<PassportSnapshot>(`/passports/${encodeURIComponent(token)}`)
}

export type PassportListItem = {
  id: string
  analysis_id: string
  created_at?: string | null
  expires_at?: string | null
  revoked_at?: string | null
  status: 'active' | 'expired' | 'revoked' | string
  risk_band?: string | null
  risk_score?: number | null
  summary?: string | null
  rules_version?: string | null
}

export function listMyPassports() {
  return apiFetch<{ items: PassportListItem[]; next_cursor: string | null }>('/passports')
}

export function revokePassport(id: string) {
  return apiFetch<void>(`/passports/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export type TranslationResponse = {
  language: string
  recommendations: Array<Record<string, unknown>>
  risk_factors: Array<Record<string, unknown>>
  disclaimer?: Record<string, unknown>
  translation_note?: string | null
}

export function translateExplanations(payload: { language: string; recommendations?: unknown[]; risk_factors?: unknown[]; factors?: unknown[] }) {
  return apiFetch<TranslationResponse>('/explanations/translate', { method: 'POST', body: JSON.stringify(payload) })
}

export type WordingExplanationItem = {
  clause?: string | null
  explanation?: string
  confidence?: string
  method?: string
}

export type WordingExplanation = {
  original_text: string
  explanations: WordingExplanationItem[]
  translation?: Record<string, unknown>
}

export function explainWording(payload: { text: string }) {
  return apiFetch<WordingExplanation>('/explanations/wording', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function analyzeOfferLetter(form: FormData) {
  return apiFetch<Record<string, unknown>>('/analyze/offer-letter', { method: 'POST', body: form })
}
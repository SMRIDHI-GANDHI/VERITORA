export const API = process.env.E2E_API_URL ?? 'http://localhost:8000/api/v1'
export const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? 'DemoPass123!'

export const DEMO_EMAILS = {
  user: 'demo-user@veritora.example.com',
  moderator: 'demo-mod@veritora.example.com',
} as const

export type Role = keyof typeof DEMO_EMAILS

export type Session = {
  access_token: string
  token_type?: string
  user: Record<string, unknown>
}

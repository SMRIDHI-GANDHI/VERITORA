import { request as playwrightRequest } from '@playwright/test'
import { API } from './env'
import { expect, signIn, test } from './fixtures'

/**
 * docs/10-TEST-PLAN.md §6 journeys A–E against the live API and seeded demo
 * accounts. Journey C writes a clearly-labelled synthetic report; nothing is
 * deleted afterwards (the platform has no hard-delete path).
 */
test.describe('journey A — check a job posting', () => {
  test('submitting a job shows a decision-support result, not a verdict', async ({ page, userAuth }) => {
    await signIn(page, userAuth)
    await page.goto('/analyze')
    await page.getByLabel('Job title').fill('Remote Data Entry')
    await page
      .getByLabel('Job description')
      .fill(
        'Congratulations, you are selected. Please pay Rs 1500 registration fee to confirm your selection. Reply immediately.',
      )
    await page.getByRole('button', { name: 'Analyze job' }).click()

    await expect(page).toHaveURL(/\/analysis\/[0-9a-f-]+$/i)
    await expect(page.getByRole('heading', { name: 'Analysis result' })).toBeVisible()
    await expect(page.getByText('Decision support, not a verdict.')).toBeVisible()
    await expect(page.getByText(/Risk indicator:/)).toBeVisible()
    await expect(page.getByText(/High concern|Moderate concern|Lower concern|Insufficient information/)).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Wording check' })).toBeVisible()
    await page.getByRole('button', { name: 'Explain evidence wording' }).click()
    await expect(page.getByText(/upfront payment require strong/i)).toBeVisible({ timeout: 20_000 })
    expect(await page.locator('mark').count()).toBeGreaterThan(0)

    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/\bfake\b|\bgenuine\b/i)
  })

  test('the landing quick check prefills the analyzer from pasted text', async ({ page, userAuth }) => {
    await signIn(page, userAuth)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Check before you trust.' })).toBeVisible()

    await page
      .getByLabel('Paste a job post, recruiter message, or link')
      .fill('Urgent hiring! Pay Rs 1500 registration fee within 24 hours to confirm your seat.')
    await page.getByRole('button', { name: 'Check it' }).click()

    await expect(page).toHaveURL(/\/analyze\?tab=job$/)
    await expect(page.getByLabel('Job description')).toHaveValue(/Pay Rs 1500 registration fee within 24 hours/)
    await expect(page.getByText(/do not paste passwords, OTPs/)).toBeVisible()

    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/\bfake\b|\bgenuine\b/i)
  })
})

test.describe('journey B — verify a company', () => {
  test('verification lists matched, mismatched and unknown fields with source + timestamp', async ({
    page,
    userAuth,
  }) => {
    await signIn(page, userAuth)
    await page.goto('/verify/company')
    await page.getByLabel('Company name').fill('Synthetic GoodTech')
    await page.getByLabel('Website (optional)').fill('https://example.com')
    await page.getByLabel('Email domain (optional)').fill('example.com')
    await page.getByRole('button', { name: 'Verify company' }).click()

    await expect(page.getByRole('heading', { name: 'Overall status' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/Checked at:/)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Verification checks' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Community reports (approved)' })).toBeVisible()

    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/\bfake\b|\bgenuine\b/i)
    expect(body).not.toMatch(/verified genuine/i)
  })
})

test.describe('journey C — submit a report, moderate it, see a neutral public entry', () => {
  test.setTimeout(60_000)

  test('approved report appears publicly with neutral wording', async ({ page, userAuth, moderatorAuth }) => {
    const company = `Synthetic E2E Neutral Co ${Date.now()}`
    const neutralSummary =
      'User-submitted report: a fee was requested before an offer letter. Moderated and published as an allegation, not a confirmed finding.'

    await signIn(page, userAuth)
    await page.goto('/reports/new')
    await page.getByLabel('Company name').fill(company)
    await page.getByLabel('Category').selectOption('payment_request')
    await page
      .getByLabel('Description')
      .fill('The recruiter asked for an upfront registration fee before sharing the offer letter. I did not pay.')
    await page
      .getByLabel(/I understand this is a user-submitted report pending review/i)
      .check()
    await page.getByRole('button', { name: 'Submit report' }).click()

    await expect(page.getByRole('heading', { name: /Report submitted \(pending review\)/i })).toBeVisible()
    const idLine = await page.locator('p', { hasText: 'Report ID:' }).first().innerText()
    const match = idLine.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    expect(match, `could not read report id from "${idLine}"`).not.toBeNull()
    const reportId = match![0]

    // Moderate through the API using the worker's moderator access token, so we
    // never need a second interactive login that would rotate the cookie.
    const moderator = await playwrightRequest.newContext({
      extraHTTPHeaders: { Authorization: `Bearer ${moderatorAuth.access_token}` },
    })
    try {
      const patch = await moderator.patch(`${API}/admin/reports/${reportId}`, {
        data: {
          action: 'approve',
          reason: 'E2E journey C: synthetic report, verified as a user allegation.',
          public_summary: neutralSummary,
        },
      })
      expect(patch.ok(), await patch.text()).toBeTruthy()

      const list = await moderator.get(`${API}/reports?company=${encodeURIComponent(company)}`)
      expect(list.ok()).toBeTruthy()
      const body = (await list.json()) as { items: Array<{ public_summary: string | null }> }
      expect(body.items.map((item) => item.public_summary)).toContain(neutralSummary)
    } finally {
      await moderator.dispose()
    }

    await page.goto('/reports')
    await page.getByLabel('Search approved reports').fill(company)
    await expect(page.getByRole('heading', { name: company })).toBeVisible()
    await expect(page.getByText('user-submitted report', { exact: true })).toBeVisible()
    await expect(page.getByText(neutralSummary)).toBeVisible()
    await expect(page.getByText(/not a confirmed fact or legal finding/i)).toBeVisible()

    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/\bgenuine\b/i)
  })
})

test.describe('journey D — moderator reviews related patterns', () => {
  test('network review shows the neutral lead notice and an accessible table alternative', async ({
    page,
    moderatorAuth,
  }) => {
    await signIn(page, moderatorAuth)
    await page.goto('/admin/network')
    await expect(page.getByRole('heading', { name: /network alerts/i })).toBeVisible()
    await expect(page.getByText('Lead for review, not proof of wrongdoing.')).toBeVisible()

    await page.getByRole('button', { name: 'Table view (accessible)' }).click()
    // Either a real relationships table or the approved empty state.
    const hasTable = await page.getByRole('table').isVisible().catch(() => false)
    const hasEmpty = await page.getByText('No network alerts available.').isVisible().catch(() => false)
    expect(hasTable || hasEmpty).toBeTruthy()

    await page.goto('/admin/trends')
    await expect(page.getByRole('heading', { name: /trends & early warning/i })).toBeVisible()
  })
})

test.describe('journey E — official cybercrime reporting routes', () => {
  test('cyber help shows the helpline, portal and non-official notice', async ({ page }) => {
    await page.goto('/help/cybercrime')
    await expect(page.getByRole('heading', { name: /report cybercrime/i })).toBeVisible()
    await expect(page.getByText(/VERITORA is not the official portal/i)).toBeVisible()

    const helpline = page.locator('a[href="tel:1930"]')
    await expect(helpline).toBeVisible()
    await expect(helpline).toContainText('1930')

    const portal = page.locator('a[href="https://cybercrime.gov.in/"]')
    await expect(portal).toBeVisible()
    await expect(portal).toHaveAttribute('target', '_blank')
    await expect(portal).toHaveAttribute('rel', /noopener/)

    await expect(page.getByText(/CERT-In is an incident-response body/i)).toBeVisible()
  })
})

test.describe('message analyzer — conversation escalation', () => {
  test('the /message-analyzer deep link flags escalation and highlights evidence per message', async ({
    page,
    userAuth,
  }) => {
    await signIn(page, userAuth)
    await page.goto('/message-analyzer')
    await expect(page).toHaveURL(/\/analyze\?tab=message$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Message analyzer' })).toBeVisible()

    await page.getByLabel('Message 1').fill('Hi, thanks for applying. We will review your profile.')
    await page.getByRole('button', { name: 'Add message' }).click()
    await page
      .getByLabel('Message 2')
      .fill('Pay Rs 1500 registration fee within 24 hours or the offer expires.')
    await page.locator('#msg-sender-1').selectOption('recruiter')
    await page.getByRole('button', { name: 'Analyze conversation' }).click()

    await expect(page.getByRole('heading', { name: 'Conversation analysis' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('UPFRONT_PAYMENT')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Escalation across the conversation' })).toBeVisible()
    await expect(page.locator('mark').first()).toBeVisible()

    const text = await page.locator('body').innerText()
    expect(text).not.toMatch(/\bfake\b|\bgenuine\b/i)
  })
})

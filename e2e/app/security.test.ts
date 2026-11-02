import { expect, test } from '@playwright/test'
import { collectConsoleMessages } from '../console.ts'

test(`pages set security headers`, async ({ request }) => {
  const response = await request.get(`/`)

  expect(response.headers()).toMatchObject({
    'strict-transport-security': `max-age=31536000; includeSubDomains`,
    'x-content-type-options': `nosniff`,
    'x-frame-options': `SAMEORIGIN`,
    'referrer-policy': `no-referrer`,
  })
})

test(`every script on the page has the policy's nonce`, async ({ page }) => {
  const violations = collectConsoleMessages(page, message =>
    message.text().includes(`Content Security Policy`),
  )

  const response = await page.goto(`/`)
  const policy = response?.headers()[`content-security-policy`] ?? ``
  const nonce = /'nonce-(?<nonce>[^']+)'/u.exec(policy)?.groups?.nonce
  const scriptNonces = await page
    .locator(`script`)
    .evaluateAll(scripts => scripts.map(script => script.nonce))

  expect(nonce).toBeTruthy()
  expect(new Set(scriptNonces)).toStrictEqual(new Set([nonce]))
  expect(violations).toStrictEqual([])
})

test(`a form posted from another site is rejected`, async ({ request }) => {
  const response = await request.post(`/api/auth/sign-in/email`, {
    headers: { origin: `https://evil.example`, 'sec-fetch-site': `cross-site` },
    data: { email: `educator@example.com`, password: `password` },
  })

  expect(response.status()).toBe(403)
  expect(await response.text()).toBe(`Cross-origin request rejected`)
})

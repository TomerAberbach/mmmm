import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { signInConfirmed } from './auth.ts'
import { readNewestActionLink } from './mailbox.ts'

// Tests can't change the server's environment once it starts, so each test
// that needs an admin takes its own address from this record
export const ADMINS = {
  authenticatorApp: `authenticator-app-admin@example.com`,
  passkey: `passkey-admin@example.com`,
  otherBrowser: `other-browser-admin@example.com`,
  setup: `setup-admin@example.com`,
  publish: `publish-admin@example.com`,
  unpublish: `unpublish-admin@example.com`,
  check: `check-admin@example.com`,
  contest: `contest-admin@example.com`,
  staysPublished: `stays-published-admin@example.com`,
}

export const ADMIN_LIST = Object.values(ADMINS)

// Chromium's virtual authenticator stands in for a device that checks a
// fingerprint, face, or PIN
const addVirtualAuthenticator = async (page: Page): Promise<void> => {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send(`WebAuthn.enable`)
  await cdp.send(`WebAuthn.addVirtualAuthenticator`, {
    options: {
      protocol: `ctap2`,
      transport: `internal`,
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

export const openSetupLink = async (
  page: Page,
  email: string,
): Promise<void> => {
  await page.goto(`/admin`)
  await expect(page).toHaveURL(`/admin/setup`)
  await page.getByRole(`button`, { name: `Email me a setup link` }).click()
  await expect(page.getByRole(`status`)).toContainText(`We emailed you`)
  await page.goto(
    await readNewestActionLink(page, email, `Set up a second factor`),
  )
  await expect(
    page.getByRole(`heading`, { name: `Authenticator app` }),
  ).toBeVisible()
}

// Signs in as a new admin with a passkey, so the admin area opens
export const signInAsAdmin = async (
  page: Page,
  email: string,
): Promise<void> => {
  await addVirtualAuthenticator(page)
  await signInConfirmed(page, email)
  await openSetupLink(page, email)
  await page.getByRole(`button`, { name: `Add a passkey` }).click()
  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
}

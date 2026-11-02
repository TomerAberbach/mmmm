import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readTotpCode } from '../../test/totp.ts'
import { ADMIN_LIST, openSetupLink, signInAsAdmin } from '../admins.ts'
import {
  newEmailAddress,
  PASSWORD,
  signIn,
  signInConfirmed,
  signOut,
} from '../auth.ts'
import { readActionLink, readEmails } from '../mailbox.ts'

const [
  AUTHENTICATOR_APP_ADMIN = ``,
  PASSKEY_ADMIN = ``,
  OTHER_BROWSER_ADMIN = ``,
] = ADMIN_LIST

// Reads the key under "Can't scan it?", as an educator would type it
const readTotpUri = async (page: Page): Promise<string> => {
  await page.getByRole(`button`, { name: `Can't scan it?` }).click()
  const key = await page
    .getByText(/^[A-Z2-7]{4}(?: [A-Z2-7]{1,4})+$/u)
    .innerText()
  return `otpauth://totp/MMMM?secret=${key.replaceAll(` `, ``)}`
}

const enterCode = async (page: Page, code: string): Promise<void> => {
  await page.getByLabel(`Security code`).fill(code)
}

test(`educators who aren't admins get the not-found page`, async ({ page }) => {
  await signInConfirmed(page, newEmailAddress())

  const response = await page.goto(`/admin`)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `Page not found` }),
  ).toBeVisible()
})

test(`an admin sets up an authenticator app and enters its code at sign-in`, async ({
  page,
}) => {
  await signInConfirmed(page, AUTHENTICATOR_APP_ADMIN)
  await openSetupLink(page, AUTHENTICATOR_APP_ADMIN)
  await page.getByRole(`link`, { name: `Use an authenticator app` }).click()
  await page.getByLabel(`Password`, { exact: true }).fill(PASSWORD)
  await page.getByRole(`button`, { name: `Continue` }).click()
  const totpUri = await readTotpUri(page)
  await enterCode(page, readTotpCode(totpUri))
  await page.getByRole(`button`, { name: `Turn on` }).click()
  await page.getByText(`I've saved these codes`).click()
  await page.getByRole(`link`, { name: `Continue` }).click()
  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
  await signOut(page)

  await signIn(page, AUTHENTICATOR_APP_ADMIN)
  await expect(page).toHaveURL(`/sign-in/code`)
  await enterCode(page, readTotpCode(totpUri))
  await page.getByRole(`button`, { name: `Continue` }).click()
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
  await page.goto(`/admin`)

  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
})

test(`an admin adds a passkey and signs in with it`, async ({ page }) => {
  await signInAsAdmin(page, PASSKEY_ADMIN)
  await signOut(page)

  await page.goto(`/sign-in`)
  await page.getByRole(`button`, { name: `Sign in with a passkey` }).click()
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
  await page.goto(`/admin`)

  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
})

test(`a setup link opened in another browser doesn't start setup there`, async ({
  page,
  browser,
  baseURL,
}) => {
  await signInConfirmed(page, OTHER_BROWSER_ADMIN)
  await page.goto(`/admin`)
  await page.getByRole(`button`, { name: `Email me a setup link` }).click()
  await expect(page.getByRole(`status`)).toContainText(`We emailed you`)
  const [latest = ``] = await readEmails(page, OTHER_BROWSER_ADMIN, {
    newestContaining: `Set up a second factor`,
  })
  const link = readActionLink(latest, `Set up a second factor`)
  const otherContext = await browser.newContext({ baseURL })
  const other = await otherContext.newPage()

  await other.goto(link)
  await expect(other).toHaveURL(`/sign-in`)
  await otherContext.close()
  await page.goto(link)

  await expect(
    page.getByRole(`heading`, { name: `Authenticator app` }),
  ).toBeVisible()
})

import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readTotpCode } from '../../test/totp.ts'
import { ADMINS, openSetupLink, signInAsAdmin } from '../admins.ts'
import {
  newEmailAddress,
  PASSWORD,
  signIn,
  signInConfirmed,
  signOut,
} from '../auth.ts'
import { fillBracketForm } from '../brackets.ts'
import { readNewestActionLink } from '../mailbox.ts'

/** Reads the key under "Can’t scan it?", as an educator would type it */
const readTotpUri = async (page: Page): Promise<string> => {
  await page.getByRole(`button`, { name: `Can’t scan it?` }).click()
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
  await signInConfirmed(page, ADMINS.authenticatorApp)
  await openSetupLink(page, ADMINS.authenticatorApp)
  await page.getByRole(`link`, { name: `Use an authenticator app` }).click()
  await page.getByLabel(`Password`, { exact: true }).fill(PASSWORD)
  await page.getByRole(`button`, { name: `Continue` }).click()
  const totpUri = await readTotpUri(page)
  await enterCode(page, readTotpCode(totpUri))
  await page.getByRole(`button`, { name: `Turn on` }).click()
  await page.getByText(`I’ve saved these codes`).click()
  await page.getByRole(`link`, { name: `Continue` }).click()
  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
  await signOut(page)

  await signIn(page, ADMINS.authenticatorApp)
  await expect(page).toHaveURL(`/sign-in/code`)
  await enterCode(page, readTotpCode(totpUri))
  await page.getByRole(`button`, { name: `Continue` }).click()
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
  await page.goto(`/admin`)

  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
})

test(`an admin adds a passkey and signs in with it`, async ({ page }) => {
  await signInAsAdmin(page, ADMINS.passkey)
  await signOut(page)

  await page.goto(`/sign-in`)
  await page.getByRole(`button`, { name: `Sign in with a passkey` }).click()
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
  await page.goto(`/admin`)

  await expect(page.getByRole(`heading`, { name: `Admin` })).toBeVisible()
})

test(`a passkey returns to the admin page the visitor was going to`, async ({
  page,
}) => {
  await signInAsAdmin(page, ADMINS.returnPath)
  await signOut(page)
  await page.goto(`/admin/educators`)
  await expect(page).toHaveURL(`/sign-in?to=%2Fadmin%2Feducators`)

  await page.getByRole(`button`, { name: `Sign in with a passkey` }).click()

  await expect(page).toHaveURL(`/admin/educators`)
})

test(`a password returns an admin only as far as their second factor`, async ({
  page,
}) => {
  await signInAsAdmin(page, ADMINS.returnPathPassword)
  await signOut(page)
  await page.goto(`/admin/educators`)
  await page.getByLabel(`Email address`).fill(ADMINS.returnPathPassword)
  await page.getByLabel(`Password`, { exact: true }).fill(PASSWORD)

  await page.getByRole(`button`, { name: `Sign in`, exact: true }).click()

  await expect(page).toHaveURL(`/admin/verify`)
})

test(`the header links only admins to the admin area, whose pages link back`, async ({
  page,
  browser,
}) => {
  const educator = await browser.newPage()
  await signInConfirmed(educator, newEmailAddress())
  await signInAsAdmin(page, ADMINS.links)
  await page.goto(`/contests`)

  await page.getByRole(`banner`).getByRole(`link`, { name: `Admin` }).click()
  await page.getByRole(`link`, { name: `Educators` }).click()
  await page.getByRole(`main`).getByRole(`link`, { name: `Admin` }).click()

  await expect(page).toHaveURL(`/admin`)
  await expect(
    educator.getByRole(`banner`).getByRole(`link`, { name: `Ms. Frizzle` }),
  ).toBeVisible()
  await expect(
    educator.getByRole(`banner`).getByRole(`link`, { name: `Admin` }),
  ).not.toBeAttached()
})

test(`a setup link opened in another browser doesn't start setup there`, async ({
  page,
  browser,
  baseURL,
}) => {
  await signInConfirmed(page, ADMINS.otherBrowser)
  await page.goto(`/admin`)
  await page.getByRole(`button`, { name: `Email me a setup link` }).click()
  await expect(page.getByRole(`status`)).toContainText(`We emailed you`)
  const link = await readNewestActionLink(
    page,
    ADMINS.otherBrowser,
    `Set up a second factor`,
  )
  const otherContext = await browser.newContext({ baseURL })
  const other = await otherContext.newPage()

  await other.goto(link)
  await expect(other).toHaveURL(`/sign-in?to=%2Fadmin%2Fsetup`)
  await otherContext.close()
  await page.goto(link)

  await expect(
    page.getByRole(`heading`, { name: `Authenticator app` }),
  ).toBeVisible()
})

test(`an unsaved bracket stays on the page when its session ran out`, async ({
  page,
  context,
}) => {
  await signInAsAdmin(page, ADMINS.lostSession)
  await page.goto(`/admin/bracket`)
  await fillBracketForm(page)
  const other = await context.newPage()
  await other.goto(`/admin`)
  await signOut(other)

  await page.getByRole(`button`, { name: `Save bracket` }).click()
  await expect(page.getByText(`You’re signed out`)).toBeVisible()
  await expect(page.getByLabel(`Seed 1`).first()).toHaveValue(`Combatant 1`)

  await signIn(other, ADMINS.lostSession)
  await expect(other.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
  await page.getByRole(`button`, { name: `Save bracket` }).click()
  await expect(
    page.getByText(`The admin area needs your second factor again`),
  ).toBeVisible()

  await expect(page.getByLabel(`Seed 1`).first()).toHaveValue(`Combatant 1`)
})

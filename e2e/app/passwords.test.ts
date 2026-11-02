import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  newEmailAddress,
  PASSWORD,
  readSession,
  requestReset,
  signIn,
  signInConfirmed,
  signUp,
  signUpConfirmed,
} from '../auth.ts'
import { readEmails, readNewestActionLink } from '../mailbox.ts'

// Adds signing the educator in from a second browser, with its own cookies,
// which closes after the test
const test = base.extend<{
  signInElsewhere: (email: string) => Promise<Page>
}>({
  signInElsewhere: async ({ browser, baseURL }, provide) => {
    const contexts: { close: () => Promise<void> }[] = []
    await provide(async email => {
      const context = await browser.newContext({ baseURL })
      contexts.push(context)
      const page = await context.newPage()
      await signIn(page, email)
      await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
      return page
    })
    await Promise.all(contexts.map(context => context.close()))
  },
})

const NEW_PASSWORD = `a brand new password`

const readResetLink = (page: Page, email: string) =>
  readNewestActionLink(page, email, `Set a new password`)

const setNewPassword = async (page: Page, link: string) => {
  await page.goto(link)
  await page.getByLabel(`New password`, { exact: true }).fill(NEW_PASSWORD)
  await page.getByRole(`button`, { name: `Set password` }).click()
  await expect(page).toHaveURL(`/sign-in?password-reset`)
}

const changePassword = async (page: Page, currentPassword: string) => {
  await page.goto(`/settings`)
  await page
    .getByLabel(`Current password`, { exact: true })
    .fill(currentPassword)
  await page.getByLabel(`New password`, { exact: true }).fill(NEW_PASSWORD)
  await page.getByRole(`button`, { name: `Change password` }).click()
}

test(`a reset link sets a new password to sign in with`, async ({ page }) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  await requestReset(page, email)

  await setNewPassword(page, await readResetLink(page, email))
  await expect(page.getByRole(`status`)).toContainText(
    `Your password is changed`,
  )
  await signIn(page, email, NEW_PASSWORD)

  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
})

test(`the old password stops working after a reset`, async ({ page }) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  await requestReset(page, email)
  await setNewPassword(page, await readResetLink(page, email))

  await signIn(page, email, PASSWORD)

  await expect(page.getByRole(`alert`)).toHaveText(
    `Email address or password is incorrect`,
  )
})

test(`a reset link confirms an unconfirmed educator`, async ({ page }) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await requestReset(page, email)

  await setNewPassword(page, await readResetLink(page, email))
  await signIn(page, email, NEW_PASSWORD)

  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
})

test(`a reset link works once`, async ({ page }) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  await requestReset(page, email)
  const link = await readResetLink(page, email)
  await setNewPassword(page, link)

  await page.goto(link)

  await expect(page.getByRole(`alert`)).toContainText(
    `expired or was already used`,
  )
})

test(`a reset for an unknown address answers the same and sends nothing`, async ({
  page,
}) => {
  const unknown = newEmailAddress()
  const known = newEmailAddress()
  await signUpConfirmed(page, known)

  await requestReset(page, unknown)
  // Resets send after responding. Once a later reset's email arrives, the
  // unknown address's would have too
  await requestReset(page, known)
  await readResetLink(page, known)

  await expect(
    page.getByRole(`listitem`).filter({ hasText: ` to ${unknown},` }),
  ).toHaveCount(0)
})

test(`resetting a password emails a notice and signs out every session`, async ({
  page,
  signInElsewhere,
}) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  const elsewhere = await signInElsewhere(email)
  await requestReset(page, email)

  await setNewPassword(page, await readResetLink(page, email))

  expect(await readSession(elsewhere)).toBeNull()
  const [latest = ``] = await readEmails(page, email, {
    newestContaining: `Your password was changed`,
  })
  expect(latest).toContain(`Your password was changed`)
})

test(`changing the password signs out other sessions but not this one`, async ({
  page,
  signInElsewhere,
}) => {
  const email = newEmailAddress()
  await signInConfirmed(page, email)
  const elsewhere = await signInElsewhere(email)

  await changePassword(page, PASSWORD)

  await expect(page.getByRole(`status`)).toContainText(
    `Your password is changed`,
  )
  expect(await readSession(elsewhere)).toBeNull()
  expect(await readSession(page)).not.toBeNull()
})

test(`changing the password emails a notice`, async ({ page }) => {
  const email = newEmailAddress()
  await signInConfirmed(page, email)

  await changePassword(page, PASSWORD)
  await expect(page.getByRole(`status`)).toBeVisible()

  const [latest = ``] = await readEmails(page, email, {
    newestContaining: `Your password was changed`,
  })
  expect(latest).toContain(`Your password was changed`)
})

test(`a wrong current password keeps the old password`, async ({ page }) => {
  const email = newEmailAddress()
  await signInConfirmed(page, email)

  await changePassword(page, `not the password`)

  await expect(
    page.getByText(`Your current password is incorrect`),
  ).toBeVisible()
})

test(`signing out other sessions keeps this one`, async ({
  page,
  signInElsewhere,
}) => {
  const email = newEmailAddress()
  await signInConfirmed(page, email)
  const elsewhere = await signInElsewhere(email)
  await page.goto(`/settings`)

  await page.getByRole(`button`, { name: `Sign out other sessions` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Sign out other sessions` })
    .click()

  await expect(page.getByRole(`status`)).toContainText(
    `Every other session is signed out`,
  )
  expect(await readSession(elsewhere)).toBeNull()
  expect(await readSession(page)).not.toBeNull()
})

test(`changing the name shows it in the header`, async ({ page }) => {
  const email = newEmailAddress()
  await signInConfirmed(page, email)
  await page.getByRole(`link`, { name: `Ms. Frizzle` }).click()

  await page.getByLabel(`Full name`).fill(`Valerie Frizzle`)
  await page.getByRole(`button`, { name: `Save name` }).click()

  await expect(page.getByRole(`status`)).toContainText(`Your name is saved`)
  await expect(page.getByRole(`banner`)).toContainText(`Valerie Frizzle`)
})

test(`settings sends signed-out visitors to sign in`, async ({ page }) => {
  await page.goto(`/settings`)

  await expect(page).toHaveURL(`/sign-in`)
})

import { expect, test } from '@playwright/test'
import {
  confirm,
  isSignedIn,
  newEmailAddress,
  PASSWORD,
  signIn,
  signInConfirmed,
  signOut,
  signUp,
  signUpConfirmed,
} from '../auth.ts'
import { readActionLink, readEmails, readNewestActionLink } from '../mailbox.ts'

test(`an educator who confirms from the email can sign in`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await confirm(page, email)

  await signIn(page, email)

  await expect(page).toHaveURL(`/contests`)
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
})

test(`the home page sends a signed-in educator to their contests`, async ({
  page,
}) => {
  await signInConfirmed(page, newEmailAddress())

  await page.goto(`/`)

  await expect(page).toHaveURL(`/contests`)
  await expect(
    page.getByRole(`heading`, { name: `Your contests` }),
  ).toBeVisible()
})

test(`confirming doesn't sign in whoever opens the confirmation link`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  await confirm(page, email)

  expect(await isSignedIn(page)).toBe(false)
})

test(`an unconfirmed educator can't sign in, and is told to confirm first`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  await signIn(page, email)

  await expect(
    page.getByText(`Confirm your address before you sign in`),
  ).toBeVisible()
})

test(`signing up with a confirmed address looks like a new sign-up and emails its owner`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await confirm(page, email)

  await signUp(page, email, { name: `Someone Else` })

  const [latest = ``] = await readEmails(page, email)
  expect(latest).toContain(`You already have an account`)
  expect(readActionLink(latest, `Sign in`)).toContain(`/sign-in`)
  expect(latest).toContain(`/forgot-password`)
})

test(`a wrong password doesn't say which field was wrong`, async ({ page }) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await confirm(page, email)

  await signIn(page, email, `not the password`)

  await expect(page.getByRole(`alert`)).toHaveText(
    `Email address or password is incorrect`,
  )
})

test(`signing out ends the session`, async ({ page }) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await confirm(page, email)
  await signIn(page, email)

  await signOut(page)

  expect(await isSignedIn(page)).toBe(false)
})

test(`an altered confirmation link says to sign in for a new one`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  const link = new URL(
    await readNewestActionLink(page, email, `Confirm email address`),
  )
  link.searchParams.set(`token`, `altered`)

  await page.goto(link.href)

  await expect(page.getByRole(`alert`)).toContainText(
    `Sign in to get a new one`,
  )
})

test(`the auth route answers only what browsers call`, async ({ request }) => {
  const response = await request.post(`/api/auth/sign-up/email`, {
    data: {
      name: `Ms. Frizzle`,
      email: newEmailAddress(),
      password: PASSWORD,
    },
  })

  expect(response.status()).toBe(404)
})

test(`signing up again with an unconfirmed address sends a new confirmation link`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  await signUp(page, email)

  const emails = await readEmails(page, email)
  expect(emails).toHaveLength(2)
  expect(readActionLink(emails[0] ?? ``, `Confirm email address`)).toContain(
    `/api/auth/verify-email`,
  )
})

test(`signing up again before confirming replaces the name and password`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email, {
    name: `Someone Else`,
    password: `someone else's password`,
  })

  await signUp(page, email)
  await confirm(page, email)
  await signIn(page, email)

  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
})

test(`signing up with a confirmed address keeps its password`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await confirm(page, email)

  await signUp(page, email, { password: `someone else's password` })
  await signIn(page, email)

  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
})

test(`resending the confirmation link sends another and says when`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  await page.getByRole(`button`, { name: `Resend email` }).click()

  await expect(page.getByRole(`status`)).toContainText(`Sent again at`)
  expect(await readEmails(page, email)).toHaveLength(2)
})

test(`a confirmation link sent before signing up again no longer confirms`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  const firstLink = await readNewestActionLink(
    page,
    email,
    `Confirm email address`,
  )
  await signUp(page, email, { password: `someone else's password` })

  await page.goto(firstLink)

  await expect(page.getByRole(`alert`)).toContainText(
    `Sign in to get a new one`,
  )
})

test(`signing in returns to the page the visitor was going to`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  await page.goto(`/settings`)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Password`, { exact: true }).fill(PASSWORD)

  await page.getByRole(`button`, { name: `Sign in`, exact: true }).click()

  await expect(page).toHaveURL(`/settings`)
})

test(`a link pressed after the session ended returns there once signed in`, async ({
  page,
  context,
}) => {
  const email = newEmailAddress()
  await signInConfirmed(page, email)
  await context.clearCookies()
  await page.getByRole(`link`, { name: `Ms. Frizzle` }).click()
  await expect(page).toHaveURL(`/sign-in?to=%2Fsettings`)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Password`, { exact: true }).fill(PASSWORD)

  await page.getByRole(`button`, { name: `Sign in`, exact: true }).click()

  await expect(page).toHaveURL(`/settings`)
})

test(`sign-in never leads to another site`, async ({ page, baseURL }) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  await page.goto(`/sign-in?to=${encodeURIComponent(`//example.com`)}`)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Password`, { exact: true }).fill(PASSWORD)

  await page.getByRole(`button`, { name: `Sign in`, exact: true }).click()

  await expect(page).toHaveURL(`${baseURL}/contests`)
})

test(`signing in works without JavaScript`, async ({
  page,
  browser,
  baseURL,
}) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  })
  const plain = await context.newPage()

  await signIn(plain, email)

  await expect(plain).toHaveURL(`/contests`)
  await context.close()
})

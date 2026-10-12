import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readActionLink, readEmails } from './mailbox.ts'

const PASSWORD = `correct horse battery`

const newEmailAddress = () => `educator-${crypto.randomUUID()}@example.com`

const signUp = async (
  page: Page,
  email: string,
  { name = `Ms. Frizzle`, password = PASSWORD } = {},
) => {
  await page.goto(`/sign-up`)
  await page.getByLabel(`Full name`).fill(name)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Create a password`).fill(password)
  await page.getByRole(`button`, { name: `Sign up` }).click()
  await expect(
    page.getByRole(`heading`, { name: `Check your email` }),
  ).toBeVisible()
}

const confirm = async (page: Page, email: string) => {
  const [latest = ``] = await readEmails(page, email)
  await page.goto(readActionLink(latest, `Confirm email address`))
  await expect(page.getByRole(`status`)).toContainText(
    `Your email address is confirmed`,
  )
}

const signOut = async (page: Page) => {
  await page.getByRole(`button`, { name: `Sign out` }).click()
  await expect(page.getByRole(`link`, { name: `Sign in` })).toBeVisible()
}

const signIn = async (page: Page, email: string, password = PASSWORD) => {
  await page.goto(`/sign-in`)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Password`, { exact: true }).fill(password)
  await page.getByRole(`button`, { name: `Sign in` }).click()
}

test(`an educator who confirms from the email can sign in`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  await confirm(page, email)

  await signIn(page, email)

  await expect(page).toHaveURL(`/`)
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
})

test(`confirming doesn't sign in whoever opens the confirmation link`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  await confirm(page, email)

  const session = await page.request.get(`/api/auth/get-session`)
  expect(await session.json()).toBeNull()
})

test(`an unconfirmed educator can't sign in, and gets a new confirmation link`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  await signIn(page, email)

  await expect(
    page.getByRole(`heading`, { name: `Check your email` }),
  ).toBeVisible()
  expect(await readEmails(page, email)).toHaveLength(2)
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

  const session = await page.request.get(`/api/auth/get-session`)
  expect(await session.json()).toBeNull()
})

test(`an altered confirmation link says to sign in for a new one`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  const [latest = ``] = await readEmails(page, email)
  const link = new URL(readActionLink(latest, `Confirm email address`))
  link.searchParams.set(`token`, `altered`)

  await page.goto(link.href)

  await expect(page.getByRole(`alert`)).toContainText(
    `Sign in to get a new one`,
  )
})

test(`the auth route rejects an offensive name, even for an existing address`, async ({
  page,
  request,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)

  const response = await request.post(`/api/auth/sign-up/email`, {
    data: { name: `sh1t`, email, password: PASSWORD },
  })

  expect(response.status()).toBe(400)
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
  const [firstEmail = ``] = await readEmails(page, email)
  // A link records its time to the second, so the next sign-up must come later
  await page.waitForTimeout(1100)
  await signUp(page, email, { password: `someone else's password` })

  await page.goto(readActionLink(firstEmail, `Confirm email address`))

  await expect(page.getByRole(`alert`)).toContainText(
    `Sign in to get a new one`,
  )
})

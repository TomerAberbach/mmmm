import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readActionLink, readEmails } from './mailbox.ts'

export const PASSWORD = `correct horse battery`

export const newEmailAddress = (): string =>
  `educator-${crypto.randomUUID()}@example.com`

export const signUp = async (
  page: Page,
  email: string,
  { name = `Ms. Frizzle`, password = PASSWORD } = {},
): Promise<void> => {
  await page.goto(`/sign-up`)
  await page.getByLabel(`Full name`).fill(name)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Create a password`).fill(password)
  await page.getByRole(`button`, { name: `Sign up` }).click()
  await expect(
    page.getByRole(`heading`, { name: `Check your email` }),
  ).toBeVisible()
}

export const confirm = async (page: Page, email: string): Promise<void> => {
  const [latest = ``] = await readEmails(page, email)
  await page.goto(readActionLink(latest, `Confirm email address`))
  await expect(page.getByRole(`status`)).toContainText(
    `Your email address is confirmed`,
  )
}

export const signOut = async (page: Page): Promise<void> => {
  await page.getByRole(`button`, { name: `Sign out` }).click()
  await expect(
    page.getByRole(`banner`).getByRole(`link`, { name: `Sign in` }),
  ).toBeVisible()
}

export const signIn = async (
  page: Page,
  email: string,
  password = PASSWORD,
): Promise<void> => {
  await page.goto(`/sign-in`)
  await page.getByLabel(`Email address`).fill(email)
  await page.getByLabel(`Password`, { exact: true }).fill(password)
  await page.getByRole(`button`, { name: `Sign in` }).click()
}

export const signUpConfirmed = async (
  page: Page,
  email: string,
): Promise<void> => {
  await signUp(page, email)
  await confirm(page, email)
}

export const signInConfirmed = async (
  page: Page,
  email: string,
): Promise<void> => {
  await signUpConfirmed(page, email)
  await signIn(page, email)
  await expect(page.getByRole(`banner`)).toContainText(`Ms. Frizzle`)
}

export const readSession = async (page: Page): Promise<unknown> =>
  (await page.request.get(`/api/auth/get-session`)).json()

import { expect, test } from '@playwright/test'
import {
  newEmailAddress,
  requestReset,
  signIn,
  signUp,
  signUpConfirmed,
  submitResetRequest,
} from './auth.ts'
import { readEmails } from './mailbox.ts'

test(`an address gets 10 sign-in attempts from one browser before it has to wait`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUpConfirmed(page, email)
  for (let attempt = 0; attempt < 10; attempt++) {
    await signIn(page, email, `not the password`)
    await expect(page.getByRole(`alert`)).toHaveText(
      `Email address or password is incorrect`,
    )
  }

  await signIn(page, email, `not the password`)

  // The wait counts down from the first attempt, so a slow run can show 14
  await expect(page.getByRole(`alert`)).toHaveText(
    /^Too many attempts\. Try again in 1[45] minutes\.$/u,
  )
})

test(`an address gets 3 reset links an hour`, async ({ page }) => {
  const email = newEmailAddress()
  for (let attempt = 0; attempt < 3; attempt++) {
    await requestReset(page, email)
  }

  await submitResetRequest(page, email)

  await expect(page.getByRole(`alert`)).toContainText(`Too many attempts`)
})

test(`an address gets 3 resent confirmation links an hour`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  const resend = page.getByRole(`button`, { name: `Resend email` })
  for (let attempt = 0; attempt < 3; attempt++) {
    await resend.click()
    await expect(page.getByRole(`status`)).toContainText(`Sent again at`)
  }

  await resend.click()

  await expect(page.getByRole(`alert`)).toContainText(`Too many attempts`)
})

test(`the auth API applies the same limits`, async ({ request }) => {
  const email = newEmailAddress()
  for (let attempt = 0; attempt < 3; attempt++) {
    await request.post(`/api/auth/request-password-reset`, { data: { email } })
  }

  const response = await request.post(`/api/auth/request-password-reset`, {
    data: { email },
  })

  expect(response.status()).toBe(429)
  expect(response.headers()[`retry-after`]).toBeTruthy()
})

// Whoever set an unconfirmed educator's password could otherwise flood the
// address by signing in again and again
test(`signing in to an unconfirmed educator sends no email`, async ({
  page,
}) => {
  const email = newEmailAddress()
  await signUp(page, email)
  for (let attempt = 0; attempt < 3; attempt++) {
    await signIn(page, email)
    await expect(
      page.getByRole(`heading`, { name: `Check your email` }),
    ).toBeVisible()
  }

  const emails = await readEmails(page, email)

  expect(emails).toHaveLength(1)
})

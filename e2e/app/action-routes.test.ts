import { expect, test } from '@playwright/test'

test(`opening the address that resends a confirmation link shows sign-in`, async ({
  page,
}) => {
  await page.goto(`/resend-confirmation`)

  await expect(page).toHaveURL(`/sign-in`)
})

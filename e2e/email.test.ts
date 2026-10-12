import { expect, test } from '@playwright/test'

test(`the mailbox is open while email goes to it`, async ({ page }) => {
  await page.goto(`/dev/mailbox`)

  await expect(page.getByRole(`heading`, { name: `Mailbox` })).toBeVisible()
})

test(`the sample email page doesn't exist in production`, async ({ page }) => {
  const response = await page.goto(`/dev/email`)

  expect(response?.status()).toBe(404)
})

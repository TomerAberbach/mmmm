import { expect, test } from '@playwright/test'

test(`the mailbox is open while email goes to it`, async ({ page }) => {
  await page.goto(`/dev/mailbox`)

  await expect(page.getByRole(`heading`, { name: `Mailbox` })).toBeVisible()
})

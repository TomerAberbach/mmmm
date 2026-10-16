import { expect, test } from '@playwright/test'

test(`the bracket page returns 404 before any bracket is published`, async ({
  page,
}) => {
  const response = await page.goto(`/bracket`)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `Page not found` }),
  ).toBeVisible()
})

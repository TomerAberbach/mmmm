import { expect, test } from '@playwright/test'

test(`a personal link that matches no player says it doesn't work`, async ({
  page,
}) => {
  const response = await page.goto(`/my-bracket/not-a-personal-link`)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `This link doesn’t work` }),
  ).toBeVisible()
})

import { expect, test } from '@playwright/test'
import { collectConsoleMessages } from '../console.ts'
import { SIGNED_OUT_HOME_HEADING } from '../home-page.ts'

test(`home page renders from the production build`, async ({ page }) => {
  await page.goto(`/`)

  await expect(page).toHaveTitle(SIGNED_OUT_HOME_HEADING)
  await expect(
    page.getByRole(`heading`, { name: SIGNED_OUT_HOME_HEADING }),
  ).toBeVisible()
})

test(`unknown pages return 404`, async ({ page }) => {
  const response = await page.goto(`/nope`)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `Page not found` }),
  ).toBeVisible()
})

test(`unknown pages link to the home page`, async ({ page }) => {
  await page.goto(`/nope`)

  await page.getByRole(`link`, { name: `Go to the home page` }).click()

  await expect(
    page.getByRole(`heading`, { name: SIGNED_OUT_HOME_HEADING }),
  ).toBeVisible()
})

test(`the home page hydrates without console errors`, async ({ page }) => {
  const errors = collectConsoleMessages(
    page,
    message => message.type() === `error`,
  )

  await page.goto(`/`)
  await page.waitForLoadState(`networkidle`)

  expect(errors).toStrictEqual([])
})

for (const name of [`Sign up`, `Sign in`]) {
  test(`the signed-out home page's ${name} link opens that page`, async ({
    page,
  }) => {
    await page.goto(`/`)

    await page.getByRole(`main`).getByRole(`link`, { name }).click()

    await expect(page.getByRole(`heading`, { name })).toBeVisible()
  })
}

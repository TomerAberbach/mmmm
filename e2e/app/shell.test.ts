import { expect, test } from '@playwright/test'
import { SIGNED_OUT_HOME_HEADING } from '../home-page.ts'

test(`the footer links the privacy policy`, async ({ page }) => {
  await page.goto(`/`)

  await page.getByRole(`link`, { name: `Privacy policy` }).click()

  await expect(
    page.getByRole(`heading`, { name: `Privacy policy` }),
  ).toBeVisible()
})

test(`the not-found page keeps the support email`, async ({ page }) => {
  await page.goto(`/nope`)

  await expect(
    page.getByRole(`link`, { name: `support@example.com` }),
  ).toHaveAttribute(`href`, `mailto:support@example.com`)
})

test(`printing hides the header and footer`, async ({ page }) => {
  await page.emulateMedia({ media: `print` })

  await page.goto(`/`)

  await expect(page.getByRole(`banner`)).toBeHidden()
  await expect(page.getByRole(`contentinfo`)).toBeHidden()
  await expect(
    page.getByRole(`heading`, { name: SIGNED_OUT_HOME_HEADING }),
  ).toBeVisible()
})

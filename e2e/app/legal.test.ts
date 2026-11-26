import { expect, test } from '@playwright/test'

for (const [label, path] of [
  [`Privacy policy`, `/privacy`],
  [`Terms`, `/terms`],
  [`Retention schedule`, `/retention`],
] as const) {
  test(`the footer opens ${path}`, async ({ page }) => {
    await page.goto(`/`)

    await page
      .getByRole(`contentinfo`)
      .getByRole(`link`, { name: label })
      .click()

    await expect(page).toHaveURL(path)
    await expect(
      page.getByRole(`heading`, { level: 1, name: label }),
    ).toBeVisible()
  })
}

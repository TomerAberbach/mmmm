import { expect, test as setup } from '@playwright/test'
import { ADMINS, signInAsAdmin } from '../admins.ts'
import { setUpAndPublishBracket, YEAR } from '../brackets.ts'

// Educators create contests only once the upcoming year's bracket is published
setup(`publish the bracket`, async ({ page }) => {
  await signInAsAdmin(page, ADMINS.contest)
  await setUpAndPublishBracket(page)
  await page.getByLabel(`Expected lock date`).fill(`${YEAR}-03-19`)
  await page.getByRole(`button`, { name: `Save date` }).click()
  await expect(page.getByText(`Saved the expected lock date`)).toBeVisible()
})

import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Returns the new contest's contest link */
export const createContest = async (
  page: Page,
  name: string,
): Promise<string> => {
  await page.getByRole(`button`, { name: `Create contest` }).click()
  const dialog = page.getByRole(`dialog`)
  await dialog.getByLabel(`Contest name`).fill(name)
  await dialog.getByRole(`button`, { name: `Create contest` }).click()
  await expect(page.getByRole(`heading`, { name })).toBeVisible()
  return page.getByRole(`textbox`, { name: `Contest link` }).inputValue()
}

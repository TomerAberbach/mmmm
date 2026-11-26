import type { Page } from '@playwright/test'

/**
 * Presses `trigger`, then the dialog's `action`, which defaults to the same
 * label
 */
export const confirmDialog = async (
  page: Page,
  trigger: string,
  action = trigger,
): Promise<void> => {
  await page.getByRole(`button`, { name: trigger, exact: true }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: action, exact: true })
    .click()
}

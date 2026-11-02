import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readUpcomingYear } from '../app/year.ts'

export const YEAR = readUpcomingYear(new Date())

const DIVISION_NAMES = [`Bad Bunch`, `Fur Real`, `Nighty Night`, `Flight Club`]

// Names for the default wild card, at seed 16 of the top left division with 2
// entrants: 63 seeds, then the entrants
export const PASTED_NAMES = Array.from(
  { length: 65 },
  (_, index) => `Combatant ${index + 1}`,
).join(`\n`)

export const fillBracketForm = async (
  page: Page,
  names = PASTED_NAMES,
): Promise<void> => {
  await fillDivisionNames(page)
  await pasteNames(page, names)
}

export const setUpAndPublishBracket = async (page: Page): Promise<void> => {
  await page.goto(`/admin/bracket`)
  await fillBracketForm(page)
  await page.getByRole(`button`, { name: `Save bracket` }).click()
  await page.getByRole(`link`, { name: `Manage the ${YEAR} bracket` }).click()
  await confirmDialog(page, `Publish ${YEAR} bracket`)
  await expect(
    page.getByRole(`button`, { name: `Unpublish`, exact: true }),
  ).toBeVisible()
}

// Presses `trigger`, then the dialog's `action`, which defaults to the same
// label
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

export const createContest = async (
  page: Page,
  name: string,
): Promise<void> => {
  await page.getByRole(`button`, { name: `Create contest` }).click()
  const dialog = page.getByRole(`dialog`)
  await dialog.getByLabel(`Contest name`).fill(name)
  await dialog.getByRole(`button`, { name: `Create contest` }).click()
  await expect(page.getByRole(`heading`, { name })).toBeVisible()
}

const pasteNames = async (page: Page, names: string): Promise<void> => {
  await page.getByRole(`button`, { name: `Paste names` }).click()
  await page.getByLabel(`Names`, { exact: true }).fill(names)
  await page.getByRole(`button`, { name: `Fill in the fields` }).click()
}

const fillDivisionNames = async (page: Page): Promise<void> => {
  const divisionFields = page.getByLabel(`Division name`)
  for (const [index, name] of DIVISION_NAMES.entries()) {
    await divisionFields.nth(index).fill(name)
  }
}

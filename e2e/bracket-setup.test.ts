import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readUpcomingYear } from '../app/year.ts'
import { ADMIN_LIST, signInAsAdmin } from './admins.ts'

const ADMIN = ADMIN_LIST[3] ?? ``
const YEAR = readUpcomingYear(new Date())

const DIVISION_NAMES = [`Bad Bunch`, `Fur Real`, `Nighty Night`, `Flight Club`]

// Names for the default wild card, at seed 16 of the top left division with 2
// entrants: 63 seeds, then the entrants
const PASTED_NAMES = Array.from(
  { length: 65 },
  (_, index) => `Combatant ${index + 1}`,
).join(`\n`)

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

// One test, since every admin shares the upcoming year's one bracket
test(`an admin sets up, edits, and deletes the upcoming year's bracket`, async ({
  page,
}) => {
  await signInAsAdmin(page, ADMIN)
  await page.getByRole(`link`, { name: `Set up the ${YEAR} bracket` }).click()
  await fillDivisionNames(page)
  await pasteNames(page, PASTED_NAMES)
  await page.getByRole(`button`, { name: `Save bracket` }).click()
  await expect(page.getByText(`Unpublished`)).toBeVisible()

  await page.getByRole(`link`, { name: `Edit the ${YEAR} bracket` }).click()
  await expect(
    page
      .getByRole(`group`, { name: `top left` })
      .getByLabel(`Seed 1`, { exact: true }),
  ).toHaveValue(`Combatant 1`)
  await page.getByRole(`button`, { name: `Delete ${YEAR} bracket` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Delete ${YEAR} bracket` })
    .click()

  await expect(page.getByText(`Not set up yet`)).toBeVisible()
})

test(`saving a bracket with a name used twice lists the problem at the top`, async ({
  page,
}) => {
  await signInAsAdmin(page, ADMIN_LIST[4] ?? ``)
  await page.goto(`/admin/bracket`)
  await fillDivisionNames(page)
  await pasteNames(page, PASTED_NAMES.replace(`Combatant 2\n`, `Combatant 1\n`))

  await page.getByRole(`button`, { name: `Save bracket` }).click()

  await expect(
    page.getByRole(`region`, { name: `Fix these to save` }),
  ).toContainText(
    `Combatant 1 is also seed 2 in Bad Bunch. Give each combatant its own name`,
  )
})

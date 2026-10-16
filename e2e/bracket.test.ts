import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { readUpcomingYear } from '../app/year.ts'
import { ADMIN_LIST, signInAsAdmin } from './admins.ts'

const SETUP_ADMIN = ADMIN_LIST[3] ?? ``
const PUBLISH_ADMIN = ADMIN_LIST[4] ?? ``
const UNPUBLISH_ADMIN = ADMIN_LIST[5] ?? ``
const CHECK_ADMIN = ADMIN_LIST[6] ?? ``
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

// Presses `trigger`, then the dialog's `action`, which defaults to the same
// label
const confirm = async (
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

// Every test shares the upcoming year's one bracket, so they run in order
test.describe.configure({ mode: `serial` })

test(`the bracket page returns 404 before any bracket is published`, async ({
  page,
}) => {
  const response = await page.goto(`/bracket`)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `Page not found` }),
  ).toBeVisible()
})

test(`an admin sets up the upcoming year's bracket from a pasted list`, async ({
  page,
}) => {
  await signInAsAdmin(page, SETUP_ADMIN)
  await page.getByRole(`link`, { name: `Set up the ${YEAR} bracket` }).click()
  await fillDivisionNames(page)
  await pasteNames(page, PASTED_NAMES)

  await page.getByRole(`button`, { name: `Save bracket` }).click()

  await expect(
    page.getByRole(`link`, { name: `Manage the ${YEAR} bracket` }),
  ).toBeVisible()
})

test(`a published bracket is on the home page, with each rename`, async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page, PUBLISH_ADMIN)
  await page.getByRole(`link`, { name: `Manage the ${YEAR} bracket` }).click()
  await page.getByLabel(`Expected lock date`).fill(`${YEAR}-03-19`)
  await page.getByRole(`button`, { name: `Save date` }).click()
  await expect(page.getByText(`Saved the expected lock date`)).toBeVisible()
  await confirm(page, `Publish ${YEAR} bracket`)
  await page
    .getByRole(`button`, { name: `Rename Combatant 1`, exact: true })
    .click()
  await page
    .getByLabel(`New name for Combatant 1`, { exact: true })
    .fill(`Combatant One`)
  await page.keyboard.press(`Enter`)
  await expect(
    page.getByRole(`button`, { name: `Rename Combatant One` }),
  ).toBeVisible()

  const visitor = await browser.newPage()
  await visitor.goto(`/`)

  await expect(
    visitor.getByRole(`heading`, { name: `${YEAR} bracket` }),
  ).toBeVisible()
  await expect(
    visitor.getByText(`Expected to lock March 19, ${YEAR}`, { exact: false }),
  ).toBeVisible()
  await expect(
    visitor.getByText(`Combatant One`, { exact: true }).first(),
  ).toBeVisible()
})

test(`an unpublished bracket leaves the public pages, and can then be deleted`, async ({
  page,
}) => {
  await signInAsAdmin(page, UNPUBLISH_ADMIN)
  await page.getByRole(`link`, { name: `Manage the ${YEAR} bracket` }).click()
  await confirm(page, `Unpublish`, `Unpublish ${YEAR} bracket`)
  await expect(
    page.getByRole(`button`, { name: `Publish ${YEAR} bracket`, exact: true }),
  ).toBeVisible()
  const response = await page.goto(`/bracket`)
  expect(response?.status()).toBe(404)

  await page.goto(`/admin/bracket`)
  await confirm(page, `Delete ${YEAR} bracket`)

  await expect(page.getByText(`Not set up yet`)).toBeVisible()
})

test(`saving a bracket with a name used twice lists the problem at the top`, async ({
  page,
}) => {
  await signInAsAdmin(page, CHECK_ADMIN)
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

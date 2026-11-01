import { expect, test } from '@playwright/test'
import { ADMIN_LIST, signInAsAdmin } from '../admins.ts'
import { confirmDialog, fillBracketForm, YEAR } from '../brackets.ts'

const SETUP_ADMIN = ADMIN_LIST[3] ?? ``
const PUBLISH_ADMIN = ADMIN_LIST[4] ?? ``
const UNPUBLISH_ADMIN = ADMIN_LIST[5] ?? ``

// Each test takes the upcoming year's one bracket a step further
test.describe.configure({ mode: `serial` })

test(`an admin sets up the upcoming year's bracket from a pasted list`, async ({
  page,
}) => {
  await signInAsAdmin(page, SETUP_ADMIN)
  await page.getByRole(`link`, { name: `Set up the ${YEAR} bracket` }).click()
  await fillBracketForm(page)

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
  await confirmDialog(page, `Publish ${YEAR} bracket`)
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
  await confirmDialog(page, `Unpublish`, `Unpublish ${YEAR} bracket`)
  await expect(
    page.getByRole(`button`, { name: `Publish ${YEAR} bracket`, exact: true }),
  ).toBeVisible()
  const response = await page.goto(`/bracket`)
  expect(response?.status()).toBe(404)

  await page.goto(`/admin/bracket`)
  await confirmDialog(page, `Delete ${YEAR} bracket`)

  await expect(page.getByText(`Not set up yet`)).toBeVisible()
})

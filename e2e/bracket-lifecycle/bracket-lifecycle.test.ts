import { expect, test } from '@playwright/test'
import { ADMINS, signInAsAdmin } from '../admins.ts'
import { newEmailAddress, signInConfirmed } from '../auth.ts'
import { fillBracketForm, YEAR } from '../brackets.ts'
import { confirmDialog } from '../dialogs.ts'

// Each test takes the upcoming year's one bracket a step further
test.describe.configure({ mode: `serial` })

test(`an admin sets up the upcoming year's bracket from a pasted list`, async ({
  page,
}) => {
  await signInAsAdmin(page, ADMINS.setup)
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
  await signInAsAdmin(page, ADMINS.publish)
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

test(`the first result locks submissions until they reopen`, async ({
  page,
  browser,
}) => {
  await signInAsAdmin(page, ADMINS.results)
  await page.getByRole(`link`, { name: `Manage the ${YEAR} bracket` }).click()
  const winner = page
    .getByRole(`group`, { name: `Round 1, battle 1`, exact: true })
    .getByRole(`button`)
    .first()

  await winner.click()
  await page.getByRole(`button`, { name: `Save result and lock` }).click()

  await expect(page.getByText(/^Saved at/u)).toBeVisible()
  await expect(page.getByText(`In progress`, { exact: true })).toBeVisible()
  const educator = await browser.newPage()
  await signInConfirmed(educator, newEmailAddress())
  await expect(
    educator.getByText(`Submissions are closed.`, { exact: true }),
  ).toBeVisible()

  await winner.click()
  await page.getByRole(`button`, { name: `Clear result` }).click()
  await confirmDialog(page, `Reopen submissions`)

  await expect(page.getByText(`Open`, { exact: true })).toBeVisible()
  await educator.reload()
  await expect(
    educator.getByRole(`button`, { name: `Create contest` }),
  ).toBeVisible()
})

test(`an unpublished bracket leaves the public pages, and can then be deleted`, async ({
  page,
}) => {
  await signInAsAdmin(page, ADMINS.unpublish)
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

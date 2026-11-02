import { expect, test } from '@playwright/test'
import { ADMIN_LIST, signInAsAdmin } from '../admins.ts'
import { newEmailAddress, signInConfirmed } from '../auth.ts'
import { fillBracketForm, PASTED_NAMES, YEAR } from '../brackets.ts'

const CHECK_ADMIN = ADMIN_LIST[6] ?? ``

test(`the bracket page returns 404 before any bracket is published`, async ({
  page,
}) => {
  const response = await page.goto(`/bracket`)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `Page not found` }),
  ).toBeVisible()
})

test(`before any bracket is published, the educator dashboard says why no contest can be created yet`, async ({
  page,
}) => {
  await signInConfirmed(page, newEmailAddress())

  await expect(
    page.getByRole(`heading`, { name: `The ${YEAR} bracket isn’t ready yet` }),
  ).toBeVisible()
  await expect(
    page.getByRole(`button`, { name: `Create contest` }),
  ).not.toBeAttached()
})

test(`saving a bracket with a name used twice lists the problem at the top`, async ({
  page,
}) => {
  await signInAsAdmin(page, CHECK_ADMIN)
  await page.goto(`/admin/bracket`)
  await fillBracketForm(
    page,
    PASTED_NAMES.replace(`Combatant 2\n`, `Combatant 1\n`),
  )

  await page.getByRole(`button`, { name: `Save bracket` }).click()

  await expect(
    page.getByRole(`region`, { name: `Fix these to save` }),
  ).toContainText(
    `Combatant 1 is also seed 2 in Bad Bunch. Give each combatant its own name`,
  )
})

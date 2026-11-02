import { expect, test } from '@playwright/test'
import { ADMIN_LIST, signInAsAdmin } from '../admins.ts'
import { newEmailAddress, signInConfirmed } from '../auth.ts'
import { createContest } from '../brackets.ts'

const STAYS_PUBLISHED_ADMIN = ADMIN_LIST[8] ?? ``

// `setup.test.ts` publishes this server's bracket first

test(`an educator creates a contest whose link shows it to players`, async ({
  page,
  browser,
}) => {
  await signInConfirmed(page, newEmailAddress())
  await createContest(page, `Period 2 Biology`)
  const link = await page
    .getByRole(`textbox`, { name: `Contest link` })
    .inputValue()

  const player = await browser.newPage()
  await player.goto(link)

  await expect(
    player.getByRole(`heading`, { name: `Period 2 Biology` }),
  ).toBeVisible()
  await expect(player.getByText(`Ms. Frizzle’s contest`)).toBeVisible()
})

test(`another educator's contest page is not found`, async ({
  page,
  browser,
}) => {
  await signInConfirmed(page, newEmailAddress())
  const other = await browser.newPage()
  await signInConfirmed(other, newEmailAddress())
  await createContest(other, `Science Club`)

  const response = await page.goto(new URL(other.url()).pathname)

  expect(response?.status()).toBe(404)
})

test(`a bracket with a contest stays published`, async ({ page, browser }) => {
  const educator = await browser.newPage()
  await signInConfirmed(educator, newEmailAddress())
  await createContest(educator, `Period 3 Biology`)
  await signInAsAdmin(page, STAYS_PUBLISHED_ADMIN)

  await page.goto(`/admin/bracket`)

  await expect(
    page.getByText(
      `Educators have created contests, so the bracket stays published.`,
    ),
  ).toBeVisible()
  await expect(
    page.getByRole(`button`, { name: `Unpublish`, exact: true }),
  ).not.toBeAttached()
})

import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
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
  const link = await createContest(page, `Period 2 Biology`)

  const player = await browser.newPage()
  await player.goto(link)

  await expect(
    player.getByText(`Period 2 Biology · Ms. Frizzle’s contest`),
  ).toBeVisible()
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

// Creates a contest as a new educator, and returns its contest link
const createContestLink = async (browser: Browser): Promise<string> => {
  const educator = await browser.newPage()
  await signInConfirmed(educator, newEmailAddress())
  return createContest(educator, `Period 4 Biology`)
}

const startBracketAsMaya = async (page: Page, link: string): Promise<void> => {
  await page.goto(link)
  await page
    .getByRole(`textbox`, { name: `What’s your first name and last initial?` })
    .fill(`Maya R.`)
  await page.getByRole(`button`, { name: `Start my bracket` }).click()
  await expect(
    page.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
}

// React Router's cookies hold their value as base64-encoded JSON
const readPersonalLinkSecret = async (page: Page): Promise<string> => {
  const cookies = await page.context().cookies()
  const cookie = cookies.find(({ name }) => name.startsWith(`player-`))
  return JSON.parse(atob(decodeURIComponent(cookie!.value))) as string
}

test(`a player who returns to the contest link continues as themselves`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)

  await page.goto(link)
  await page.getByRole(`link`, { name: `Continue as Maya R.` }).click()

  await expect(
    page.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
})

test(`"Not you?" lets the next player on the computer start their own bracket`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  await page.goto(link)

  await page
    .getByRole(`button`, { name: `Not you? Start a new bracket` })
    .click()

  await expect(
    page.getByRole(`textbox`, {
      name: `What’s your first name and last initial?`,
    }),
  ).toBeVisible()
})

test(`a personal link opens the player's bracket in another browser`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  const secret = await readPersonalLinkSecret(page)
  const otherBrowser = await browser.newPage()

  await otherBrowser.goto(`/my-bracket/${secret}`)

  await expect(
    otherBrowser.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
  expect(new URL(otherBrowser.url()).pathname).toMatch(/^\/play\/.+\/bracket$/u)
})

test(`a player's picks save and follow their personal link`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  const firstBattle = page.getByRole(`radiogroup`, {
    name: `Round 1, battle 1`,
  })
  const winner = await firstBattle
    .getByRole(`radio`)
    .first()
    .getAttribute(`value`)
  await firstBattle.locator(`label`).first().click()
  await expect(page.getByText(/^Saved at/u)).toBeVisible()
  const secret = await readPersonalLinkSecret(page)
  const otherBrowser = await browser.newPage()

  await otherBrowser.goto(`/my-bracket/${secret}`)

  await expect(otherBrowser.getByText(`1 of 64 picked`)).toBeVisible()
  await expect(
    otherBrowser
      .getByRole(`radiogroup`, { name: `Round 1, battle 1` })
      .locator(`input[value="${winner}"]`),
  ).toBeChecked()
})

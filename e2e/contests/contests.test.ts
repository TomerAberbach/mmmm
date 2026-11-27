import { expect, test } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { ADMINS, signInAsAdmin } from '../admins.ts'
import { newEmailAddress, signInConfirmed } from '../auth.ts'
import { YEAR } from '../brackets.ts'
import { createContest } from '../contests.ts'
import { confirmDialog } from '../dialogs.ts'

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
  await expect(page.getByRole(`button`, { name: `Sign out` })).toBeVisible()
})

test(`a bracket with a contest stays published`, async ({ page, browser }) => {
  const educator = await browser.newPage()
  await signInConfirmed(educator, newEmailAddress())
  await createContest(educator, `Period 3 Biology`)
  await signInAsAdmin(page, ADMINS.staysPublished)

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

test(`an admin opens a reported contest and hides it`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  const visitor = await browser.newPage()
  await visitor.goto(link)
  await visitor.getByRole(`button`, { name: `Report a name` }).click()
  await visitor.getByText(`Rude or hurtful`).click()
  await visitor.getByRole(`button`, { name: `Send report` }).click()
  await expect(visitor.getByRole(`dialog`)).not.toBeVisible()
  await signInAsAdmin(page, ADMINS.reports)
  await page.goto(`/admin/reports`)

  await page.getByRole(`link`, { name: `See the contest` }).click()
  await page.getByRole(`button`, { name: `Hide Period 4 Biology` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Hide contest` })
    .click()

  await expect(page.getByText(/^Hidden · /u)).toBeVisible()
})

test(`a hidden contest's educator is told, and its players aren't`, async ({
  page,
  browser,
}) => {
  const name = `Hidden Biology`
  const { educator, link } = await createContestAsEducator(browser, name)
  await signInAsAdmin(page, ADMINS.hides)
  await page.goto(`/admin/contests/${readContestId(educator)}`)
  await page.getByRole(`button`, { name: `Hide ${name}` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Hide contest` })
    .click()
  await expect(page.getByText(/^Hidden · /u)).toBeVisible()
  const player = await browser.newPage()

  await educator.reload()
  await player.goto(link)

  const note = educator.getByText(`This contest is hidden,`)
  await expect(note).toBeVisible()
  await expect(
    educator
      .getByRole(`main`)
      .getByRole(`link`, { name: `support@example.com` }),
  ).toHaveAttribute(`href`, `mailto:support@example.com`)
  await expect(
    player.getByText(`${name} · Ms. Frizzle’s contest`),
  ).toBeVisible()
  await expect(player.getByText(`This contest is hidden`)).not.toBeAttached()
  await expect(player.content()).resolves.not.toContain(`isHidden`)
})

test(`an admin renames a contest, then erases it`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(
    browser,
    `Doomed Biology`,
  )
  const address = `/admin/contests/${readContestId(educator)}`
  await signInAsAdmin(page, ADMINS.erases)
  await page.goto(address)
  await page.getByRole(`button`, { name: `Rename`, exact: true }).click()
  const name = page.getByLabel(`Contest name`)
  await name.fill(`Renamed Biology`)
  await page.getByRole(`button`, { name: `Save` }).click()
  await expect(
    page.getByRole(`heading`, { name: `Renamed Biology` }),
  ).toBeVisible()
  await page.getByRole(`button`, { name: `Delete forever` }).click()
  const dialog = page.getByRole(`alertdialog`)
  const confirmation = dialog.getByLabel(`Type Renamed Biology to confirm`)
  await confirmation.fill(`Doomed Biology`)
  await dialog.getByRole(`button`, { name: `Delete forever` }).click()
  await expect(dialog.getByText(`This isn’t the contest’s name`)).toBeVisible()
  await confirmation.fill(`Renamed Biology`)
  await dialog.getByRole(`button`, { name: `Delete forever` }).click()

  await expect(page).toHaveURL(`/admin/contests`)
  const response = await page.goto(address)
  expect(response?.status()).toBe(404)
  const player = await browser.newPage()
  expect((await player.goto(link))?.status()).toBe(404)
})

/** Creates a contest as a new educator, and returns its contest link */
const createContestLink = async (browser: Browser): Promise<string> =>
  (await createContestAsEducator(browser)).link

/**
 * Creates a contest as a new educator, and returns the educator's page, left
 * on the contest page, and the contest link
 */
const createContestAsEducator = async (
  browser: Browser,
  name = `Period 4 Biology`,
): Promise<{ educator: Page; link: string }> => {
  const educator = await browser.newPage()
  await signInConfirmed(educator, newEmailAddress())
  const link = await createContest(educator, name)
  return { educator, link }
}

const readContestId = (educator: Page): string =>
  new URL(educator.url()).pathname.split(`/`).at(-1)!

/** By keyboard */
const pickEveryBattle = async (page: Page): Promise<void> => {
  // 64 picks take most of the default limit on CI's few cores
  test.slow()
  const nextBattle = page.getByRole(`button`, { name: `Next battle to pick` })
  while (await nextBattle.isVisible()) {
    await nextBattle.click()
    await page.keyboard.press(`Space`)
  }
  await expect(page.getByText(`64 of 64 picked`)).toBeVisible()
}

const submitEveryPick = async (page: Page): Promise<void> => {
  await pickEveryBattle(page)
  await page.getByRole(`button`, { name: `Submit bracket` }).click()
  await expect(
    page.getByRole(`heading`, { name: `Bracket submitted` }),
  ).toBeFocused()
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

test(`a player enters their name without JavaScript`, async ({
  browser,
  baseURL,
}) => {
  const link = await createContestLink(browser)
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  })
  const plain = await context.newPage()

  await startBracketAsMaya(plain, link)

  await expect(plain).toHaveURL(/\/player\/[^/]+\/bracket$/u)
  await context.close()
})

/** React Router's cookies hold their value as base64-encoded JSON */
const readPersonalLinkSecret = async (page: Page): Promise<string> => {
  const cookies = await page.context().cookies()
  const cookie = cookies.find(({ name }) => name.startsWith(`player-`))
  return JSON.parse(atob(decodeURIComponent(cookie!.value))) as string
}

test(`opening the address the picker saves to shows the player's bracket`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  const bracketUrl = page.url()

  await page.goto(`${bracketUrl}/picks`)

  expect(page.url()).toBe(bracketUrl)
})

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

test(`"Not you?" lets the next player on the device start their own bracket`, async ({
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
  expect(new URL(otherBrowser.url()).pathname).toMatch(
    /^\/player\/.+\/bracket$/u,
  )
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

test(`a player submits by keyboard, forgets their bracket on a device, and returns with their personal link`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)

  await submitEveryPick(page)
  const secret = await readPersonalLinkSecret(page)
  await expect(page.getByText(`/my-bracket/${secret}`)).toBeVisible()
  await page
    .getByRole(`button`, { name: `Done, forget my bracket here` })
    .first()
    .click()
  await page
    .getByRole(`button`, { name: `Forget my bracket`, exact: true })
    .click()
  await expect(
    page.getByRole(`heading`, { name: `This device forgot your bracket` }),
  ).toBeVisible()
  await page.goto(link)
  await expect(
    page.getByRole(`button`, { name: `Start my bracket` }),
  ).toBeVisible()

  await page.goto(`/my-bracket/${secret}`)

  await expect(page.getByText(`Submitted · waiting for approval`)).toBeVisible()
  await expect(page.getByText(`64 of 64 picked`)).not.toBeVisible()
})

test(`a player whose educator rejects their bracket sees why at their personal link`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, link)
  await submitEveryPick(page)
  const secret = await readPersonalLinkSecret(page)
  await educator.reload()

  await educator.getByRole(`button`, { name: `Reject Maya R.` }).click()
  await expect(
    educator.getByRole(`button`, { name: `Approve Maya R.` }),
  ).toBeFocused()
  await page.goto(`/my-bracket/${secret}`)

  await expect(
    page.getByText(
      `Your educator didn’t approve your bracket. You can ask them about it`,
    ),
  ).toBeVisible()
})

test(`a player whose educator deletes their bracket starts a new one, until it's restored`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, link)
  const secret = await readPersonalLinkSecret(page)
  await educator.reload()
  await educator.getByRole(`button`, { name: `More for Maya R.` }).click()
  await educator.getByRole(`menuitem`, { name: `Delete` }).click()
  await educator.getByRole(`button`, { name: `Delete bracket` }).click()
  await expect(educator.getByRole(`link`, { name: `Trash (1)` })).toBeVisible()

  await page.goto(`/my-bracket/${secret}`)
  await page.getByRole(`link`, { name: `Start a new bracket` }).click()
  await expect(
    page.getByRole(`button`, { name: `Start my bracket` }),
  ).toBeVisible()
  await educator.getByRole(`link`, { name: `Trash (1)` }).click()
  await educator.getByRole(`button`, { name: `Restore Maya R.` }).click()
  await expect(educator.getByText(`The trash is empty`)).toBeFocused()
  await page.goto(`/my-bracket/${secret}`)

  await expect(
    page.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
})

test(`a player deletes their own bracket, which the contest's trash marks`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, link)
  const secret = await readPersonalLinkSecret(page)

  await confirmDialog(page, `Delete my bracket`)

  await expect(
    page.getByRole(`heading`, { name: `Your bracket is deleted` }),
  ).toBeVisible()
  const response = await page.goto(`/my-bracket/${secret}`)
  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `This bracket was deleted` }),
  ).toBeVisible()
  await educator.reload()
  await educator.getByRole(`link`, { name: `Trash (1)` }).click()
  await expect(educator.getByText(/^Deleted by player/u)).toBeVisible()
})

test(`a deleted contest turns off its links until it's restored`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  const other = await browser.newPage({
    storageState: await educator.context().storageState(),
  })
  await other.goto(educator.url())
  await confirmDialog(educator, `Delete contest`)
  await educator.getByRole(`link`, { name: `Deleted contests (1)` }).click()
  await confirmDialog(other, `Delete contest`)
  await expect(other.getByRole(`alertdialog`).getByRole(`alert`)).toContainText(
    `This contest wasn’t deleted. Reload the page`,
  )

  await page.goto(link)
  await expect(
    page.getByRole(`heading`, { name: `Your educator deleted this contest` }),
  ).toBeVisible()
  await educator
    .getByRole(`button`, { name: `Restore Period 4 Biology` })
    .click()
  await expect(educator.getByText(`The trash is empty`)).toBeFocused()
  await page.goto(link)

  await expect(
    page.getByRole(`button`, { name: `Start my bracket` }),
  ).toBeVisible()
})

/** Starts another player's bracket in a new tab of the page's browser */
const startNextPlayer = async (page: Page, link: string): Promise<Page> => {
  const nextPlayer = await page.context().newPage()
  await nextPlayer.goto(link)
  await nextPlayer
    .getByRole(`button`, { name: `Not you? Start a new bracket` })
    .click()
  await expect(
    nextPlayer.getByRole(`button`, { name: `Start my bracket` }),
  ).toBeVisible()
  await startBracketAsMaya(nextPlayer, link)
  return nextPlayer
}

test(`picking on a page left open by another player changes neither bracket`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  const secret = await readPersonalLinkSecret(page)
  const nextPlayer = await startNextPlayer(page, link)
  const readFirstBattle = (player: Page) =>
    player.getByRole(`radiogroup`, { name: `Round 1, battle 1` })
  await readFirstBattle(nextPlayer).locator(`label`).last().click()
  await expect(nextPlayer.getByText(/^Saved at/u)).toBeVisible()

  await readFirstBattle(page).locator(`label`).first().click()

  await expect(
    page.getByText(
      `Couldn’t save. This device opens another player’s bracket now. Ask your educator for your personal link to go back to yours`,
    ),
  ).toBeVisible()
  await nextPlayer.reload()
  await expect(
    readFirstBattle(nextPlayer).getByRole(`radio`).last(),
  ).toBeChecked()
  await page.goto(`/my-bracket/${secret}`)
  await expect(page.getByText(`0 of 64 picked`)).toBeVisible()
})

test(`submitting on a page left open by another player submits neither bracket`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  await pickEveryBattle(page)
  const nextPlayer = await startNextPlayer(page, link)

  await page.getByRole(`button`, { name: `Submit bracket` }).click()

  await expect(
    page.getByText(/^Couldn’t submit\. This device opens another/u),
  ).toBeVisible()
  await nextPlayer.reload()
  await expect(nextPlayer.getByText(`0 of 64 picked`)).toBeVisible()
})

test(`discarding on a page left open by another player keeps the next player's draft`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  await submitEveryPick(page)
  await page
    .getByRole(`radiogroup`, { name: `Round 1, battle 1` })
    .locator(`label`)
    .last()
    .click()
  await expect(page.getByText(`Changes not submitted`)).toBeVisible()
  const nextPlayer = await startNextPlayer(page, link)
  await nextPlayer
    .getByRole(`radiogroup`, { name: `Round 1, battle 1` })
    .locator(`label`)
    .last()
    .click()
  await expect(nextPlayer.getByText(/^Saved at/u)).toBeVisible()

  await confirmDialog(page, `Discard changes`)

  await expect(
    page.getByText(
      /^Couldn’t discard your changes\. This device opens another/u,
    ),
  ).toBeVisible()
  await nextPlayer.reload()
  await expect(nextPlayer.getByText(`1 of 64 picked`)).toBeVisible()
})

test(`forgetting from a page left open by another player keeps the next player's bracket`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  await submitEveryPick(page)
  await page.reload()
  const nextPlayer = await startNextPlayer(page, link)

  await confirmDialog(page, `Done, forget my bracket here`, `Forget my bracket`)

  await expect(
    page.getByText(
      `This device already forgot your bracket, and opens another player’s now`,
    ),
  ).toBeVisible()
  await nextPlayer.reload()
  await expect(nextPlayer.getByText(`0 of 64 picked`)).toBeVisible()
})

/** Confirms in a page loaded before its forms named the player */
const confirmWithoutPlayer = async (
  page: Page,
  trigger: string,
  action = trigger,
): Promise<void> => {
  await page.getByRole(`button`, { name: trigger, exact: true }).click()
  const dialog = page.getByRole(`alertdialog`)
  await dialog
    .locator(`input[name="playerId"]`)
    .evaluate(input => input.remove())
  await dialog.getByRole(`button`, { name: action, exact: true }).click()
}

test(`forgetting and deleting from a page that names no player ask for a reload`, async ({
  page,
  browser,
}) => {
  await startBracketAsMaya(page, await createContestLink(browser))
  await submitEveryPick(page)
  await page.reload()

  await confirmWithoutPlayer(
    page,
    `Done, forget my bracket here`,
    `Forget my bracket`,
  )
  await expect(
    page.getByText(
      `Your bracket wasn’t forgotten. Reload the page and try again`,
    ),
  ).toBeVisible()
  await page.getByRole(`button`, { name: `Cancel` }).click()
  await confirmWithoutPlayer(page, `Delete my bracket`)
  await expect(
    page.getByText(
      `Your bracket wasn’t deleted. Reload the page and try again`,
    ),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
})

test(`a page that stays open through a new personal link keeps saving once the link opens`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, link)
  await educator.reload()
  await educator.getByRole(`button`, { name: `More for Maya R.` }).click()
  await educator
    .getByRole(`menuitem`, { name: `Replace personal link` })
    .click()
  await educator.getByRole(`button`, { name: `Replace personal link` }).click()
  const newLink = await educator
    .getByRole(`dialog`)
    .getByText(/\/my-bracket\//u)
    .textContent()
  const newTab = await page.context().newPage()
  await newTab.goto(newLink!)

  await page
    .getByRole(`radiogroup`, { name: `Round 1, battle 1` })
    .locator(`label`)
    .first()
    .click()

  await expect(page.getByText(/^Saved at/u)).toBeVisible()
})

test(`deleting from a page left open by another player deletes neither bracket`, async ({
  page,
  browser,
}) => {
  const link = await createContestLink(browser)
  await startBracketAsMaya(page, link)
  const nextPlayer = await startNextPlayer(page, link)

  await confirmDialog(page, `Delete my bracket`)

  await expect(
    page.getByText(
      `Your bracket wasn’t deleted. Open your personal link, or ask your educator for one, and try again`,
    ),
  ).toBeVisible()
  await nextPlayer.reload()
  await expect(
    nextPlayer.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
})

test(`a replaced personal link stops working, also in a browser that has it open`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, link)
  const oldSecret = await readPersonalLinkSecret(page)
  await educator.reload()
  await educator.getByRole(`button`, { name: `More for Maya R.` }).click()
  await educator
    .getByRole(`menuitem`, { name: `Replace personal link` })
    .click()
  await educator.getByRole(`button`, { name: `Replace personal link` }).click()
  const newLink = await educator
    .getByRole(`dialog`)
    .getByText(/\/my-bracket\//u)
    .textContent()

  await page.reload()
  await expect(
    page.getByRole(`heading`, { name: `This device forgot your bracket` }),
  ).toBeVisible()
  await page.goto(`/my-bracket/${oldSecret}`)
  await expect(
    page.getByRole(`heading`, { name: `This link doesn’t work` }),
  ).toBeVisible()
  await page.goto(newLink!)

  await expect(
    page.getByRole(`heading`, { name: `Maya R.’s bracket` }),
  ).toBeVisible()
})

test(`replacing the contest link keeps players' brackets without showing them the new link`, async ({
  page,
  browser,
}) => {
  const { educator, link: oldLink } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, oldLink)
  const secret = await readPersonalLinkSecret(page)
  await confirmDialog(educator, `Replace contest link`, `Replace contest link`)
  await expect(
    educator.getByText(
      `Replaced the contest link. The old one no longer works`,
    ),
  ).toBeVisible()
  const newLink = await educator
    .getByRole(`textbox`, { name: `Contest link` })
    .inputValue()
  expect(newLink).not.toBe(oldLink)

  const firstBattle = page.getByRole(`radiogroup`, {
    name: `Round 1, battle 1`,
  })
  await firstBattle.locator(`label`).first().click()
  await expect(page.getByText(/^Saved at/u)).toBeVisible()
  await page.goto(`/my-bracket/${secret}`)
  await expect(page.getByText(`1 of 64 picked`)).toBeVisible()
  const newSecret = new URL(newLink).pathname.split(`/`).at(-1)!
  expect(page.url()).not.toContain(newSecret)
  expect(await page.content()).not.toContain(newSecret)
  const response = await page.goto(oldLink)

  expect(response?.status()).toBe(404)
  await expect(
    page.getByRole(`heading`, { name: `This link doesn’t work` }),
  ).toBeVisible()
})

test(`a player who started with a replaced contest link gets no new one by deleting their bracket`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  await startBracketAsMaya(page, link)
  const secret = await readPersonalLinkSecret(page)
  await confirmDialog(educator, `Replace contest link`, `Replace contest link`)
  await expect(educator.getByText(/^Replaced the contest link/u)).toBeVisible()

  await confirmDialog(page, `Delete my bracket`)
  await expect(
    page.getByRole(`heading`, { name: `Your bracket is deleted` }),
  ).toBeVisible()
  await expect(
    page.getByRole(`link`, { name: `Start a new bracket` }),
  ).not.toBeAttached()
  await page.goto(`/my-bracket/${secret}`)

  await expect(
    page.getByRole(`heading`, { name: `This bracket was deleted` }),
  ).toBeVisible()
  await expect(
    page.getByRole(`link`, { name: `Start a new bracket` }),
  ).not.toBeAttached()
})

test(`a player goes back to their bracket from the leaderboard while submissions are open`, async ({
  page,
  browser,
}) => {
  await startBracketAsMaya(page, await createContestLink(browser))
  const { pathname } = new URL(page.url())

  await page.goto(pathname.replace(`/bracket`, `/leaderboards/contest`))

  await expect(page).toHaveURL(new RegExp(`${pathname}$`, `u`))
})

test(`a leaderboard opens only for a player the browser remembers`, async ({
  page,
  browser,
}) => {
  const player = await browser.newPage()
  await startBracketAsMaya(player, await createContestLink(browser))
  const { pathname } = new URL(player.url())

  await page.goto(pathname.replace(`/bracket`, `/leaderboards/contest`))

  await expect(page).toHaveURL(
    new RegExp(`${pathname.replace(`/bracket`, `/forgotten`)}$`, `u`),
  )
})

test(`an educator's dashboard and a player's bracket show the expected lock date`, async ({
  page,
  browser,
}) => {
  const { educator, link } = await createContestAsEducator(browser)
  const heading = `expected to lock on March 19, ${YEAR}`
  await startBracketAsMaya(page, link)
  await educator.goto(`/contests`)

  await expect(page.getByText(heading, { exact: false })).toBeVisible()
  await expect(educator.getByText(heading, { exact: false })).toBeVisible()
})

test(`a player's bare address opens their bracket`, async ({
  page,
  browser,
}) => {
  await startBracketAsMaya(page, await createContestLink(browser))
  const bracketUrl = page.url()

  await page.goto(bracketUrl.replace(`/bracket`, ``))

  await expect(page).toHaveURL(bracketUrl)
})

test(`the page that says the device forgot opens the bracket of a player it remembers`, async ({
  page,
  browser,
}) => {
  await startBracketAsMaya(page, await createContestLink(browser))
  const bracketUrl = page.url()

  await page.goto(bracketUrl.replace(`/bracket`, `/forgotten`))

  await expect(page).toHaveURL(bracketUrl)
})

test(`a player the device forgot can ask for a personal link to a bracket they started`, async ({
  page,
  browser,
}) => {
  await startBracketAsMaya(page, await createContestLink(browser))
  await page.context().clearCookies()

  await page.reload()

  await expect(
    page.getByText(
      `Open your personal link to come back to your bracket. If you don’t have one, ask your educator for a personal link to the bracket you started, or open the contest link they shared to start a new bracket.`,
    ),
  ).toBeVisible()
})

test(`an open year's page leaves out its leaderboards`, async ({ page }) => {
  await signInConfirmed(page, newEmailAddress())

  await page.goto(`/contests/years/${YEAR}`)

  await expect(
    page.getByRole(`heading`, { name: `${YEAR} bracket` }),
  ).toBeVisible()
  await expect(
    page.getByRole(`link`, { name: /leaderboard/iu }),
  ).not.toBeAttached()
})

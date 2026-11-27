import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import type { LeaderboardPage, LeaderboardRow } from '../leaderboard-row.ts'
import { Leaderboard } from './leaderboard.tsx'

const renderLeaderboard = (
  rows: LeaderboardRow[],
  leaderboardPage: LeaderboardPage[`page`] = null,
  topScore = 64,
) =>
  renderRoutes([
    {
      path: `/`,
      Component: () => (
        <Leaderboard
          leaderboard={{ rows, page: leaderboardPage, topScore }}
          reportPath='/report'
          toBracketPath={id => `/brackets/${id}`}
        />
      ),
    },
    { path: `/brackets/:id`, Component: () => <p>Opened</p> },
  ])

const PRIYA: LeaderboardRow = {
  playerId: `priya`,
  label: `Priya S.`,
  score: 64,
  rank: 1,
  isNameRemoved: false,
  isOwn: false,
}

const HIDDEN: LeaderboardRow = {
  playerId: `hidden`,
  label: `Player`,
  score: 47,
  rank: 2,
  isNameRemoved: false,
  isOwn: false,
}

const JONAH: LeaderboardRow = {
  playerId: `jonah`,
  label: `Jonah K.`,
  score: 40,
  rank: 3,
  isNameRemoved: false,
  isOwn: false,
}

const WREN: LeaderboardRow = {
  playerId: `wren`,
  label: `Wren A.`,
  score: 31,
  rank: 4,
  isNameRemoved: false,
  isOwn: false,
}

const ROWS = [PRIYA, HIDDEN, JONAH, WREN]

const podium = () => page.getByRole(`list`, { name: `Top of the leaderboard` })

test(`the top 3 rows form a podium above the others`, async () => {
  await renderLeaderboard(ROWS)

  await expect
    .element(podium().getByRole(`listitem`).nth(0))
    .toHaveTextContent(`Rank 1 64 points Priya S.`)
  await expect.element(podium().getByText(`Jonah K.`)).toBeVisible()
  await expect
    .element(page.getByRole(`row`, { name: `4 Wren A. 31` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`row`, { name: `Jonah K.` }))
    .not.toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`players who share a rank share a step`, async () => {
  await renderLeaderboard([PRIYA, { ...HIDDEN, rank: 1, score: 64 }, JONAH])

  const steps = podium().getByRole(`listitem`)
  await expect.element(steps.nth(2)).toBeVisible()
  expect(steps.nth(0).element().classList.value).toBe(
    steps.nth(1).element().classList.value,
  )
})

test(`players who share a rank past the podium stay in the table together`, async () => {
  await renderLeaderboard([PRIYA, HIDDEN, JONAH, { ...WREN, rank: 3 }])

  await expect
    .element(page.getByRole(`row`, { name: `3 Jonah K. 40` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`row`, { name: `3 Wren A. 31` }))
    .toBeVisible()
})

test(`a player without points isn't on the podium`, async () => {
  await renderLeaderboard([{ ...HIDDEN, rank: 1, score: 0 }], null, 0)

  await expect
    .element(page.getByRole(`row`, { name: `1 Player 0` }))
    .toBeVisible()
  await expect.element(podium()).not.toBeInTheDocument()
})

const TIE_NOTE = `Ties go to whoever finished their picks first.`

test(`a leaderboard that ranks a tie by time says so`, async () => {
  await renderLeaderboard([PRIYA, { ...HIDDEN, score: PRIYA.score }, JONAH])

  await expect.element(page.getByText(TIE_NOTE)).toBeVisible()
  await expectNoAxeViolations()
})

test.each([
  { scenario: `without a tie`, rows: ROWS },
  {
    scenario: `whose tied players share a rank`,
    rows: [PRIYA, { ...HIDDEN, score: PRIYA.score, rank: PRIYA.rank }, JONAH],
  },
])(`a leaderboard $scenario says nothing of ties`, async ({ rows }) => {
  await renderLeaderboard(rows)

  await expect.element(podium()).toBeVisible()
  await expect.element(page.getByText(TIE_NOTE)).not.toBeInTheDocument()
})

test(`a podium without other rows has no table`, async () => {
  await renderLeaderboard([PRIYA])

  await expect.element(podium().getByText(`Priya S.`)).toBeVisible()
  await expect.element(page.getByRole(`table`)).not.toBeInTheDocument()
})

test.each([
  { step: `first`, rows: [{ ...PRIYA, isOwn: true }, HIDDEN, JONAH] },
  { step: `second`, rows: [PRIYA, { ...HIDDEN, isOwn: true }, JONAH] },
  { step: `third`, rows: [PRIYA, HIDDEN, { ...JONAH, isOwn: true }] },
])(`the viewer's own $step step says so`, async ({ rows }) => {
  await renderLeaderboard(rows)

  await expect.element(podium().getByText(`You`, { exact: true })).toBeVisible()
  await expectNoAxeViolations()
})

test(`the viewer's own row says so`, async () => {
  await renderLeaderboard([PRIYA, HIDDEN, JONAH, { ...WREN, isOwn: true }])

  await expect
    .element(page.getByRole(`row`, { name: `4 Wren A. You 31` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test.each([`Priya S.`, `Wren A.`])(`%s's bracket opens`, async name => {
  await renderLeaderboard(ROWS)

  await page.getByRole(`link`, { name }).click()

  await expect.element(page.getByText(`Opened`)).toBeVisible()
})

test(`a leaderboard without approved submissions says so`, async () => {
  await renderLeaderboard([])

  await expect
    .element(page.getByText(`No approved brackets yet.`))
    .toBeVisible()
})

test(`a later page has no podium, and links to the others`, async () => {
  await renderLeaderboard([{ ...WREN, rank: 101 }], { number: 2, count: 3 })

  await expect.element(podium()).not.toBeInTheDocument()
  await expect.element(page.getByText(`Page 2 of 3`)).toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: `Previous` }))
    .toHaveAttribute(`href`, `/?page=1`)
  await expect
    .element(page.getByRole(`link`, { name: `Next` }))
    .toHaveAttribute(`href`, `/?page=3`)
})

test(`a removed name can't be reported, unlike a hidden one`, async () => {
  await renderLeaderboard([
    PRIYA,
    HIDDEN,
    { ...JONAH, label: `Player`, isNameRemoved: true },
  ])
  await page.getByRole(`button`, { name: `Report a name` }).click()

  await page.getByRole(`dialog`).getByRole(`button`, { name: /^1st/u }).click()

  await expect
    .element(page.getByRole(`option`, { name: `2nd · Player` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`option`, { name: `3rd · Player` }))
    .not.toBeInTheDocument()
})

test(`a leaderboard whose every name was removed has nothing to report`, async () => {
  await renderLeaderboard([{ ...PRIYA, label: `Player`, isNameRemoved: true }])

  await expect.element(podium()).toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Report a name` }))
    .not.toBeInTheDocument()
})

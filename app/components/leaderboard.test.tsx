import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import type { LeaderboardRow } from '../leaderboard-row.ts'
import { Leaderboard } from './leaderboard.tsx'

const renderLeaderboard = (rows: LeaderboardRow[]) =>
  renderRoutes([
    {
      path: `/`,
      Component: () => (
        <Leaderboard rows={rows} toBracketPath={id => `/brackets/${id}`} />
      ),
    },
    { path: `/brackets/:id`, Component: () => <p>Opened</p> },
  ])

const ROWS: LeaderboardRow[] = [
  { playerId: `priya`, label: `Priya S.`, score: 64, rank: 1, isOwn: false },
  { playerId: `hidden`, label: `Player`, score: 47, rank: 2, isOwn: false },
  { playerId: `jonah`, label: `Jonah K.`, score: 40, rank: 3, isOwn: true },
]

test(`the viewer's own row says so`, async () => {
  await renderLeaderboard(ROWS)

  await expect
    .element(page.getByRole(`row`, { name: `2 Player 47` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`row`, { name: `3 Jonah K. You 40` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a row opens its bracket`, async () => {
  await renderLeaderboard(ROWS)

  await page.getByRole(`link`, { name: `Priya S.` }).click()

  await expect.element(page.getByText(`Opened`)).toBeVisible()
})

test(`a leaderboard without approved submissions says so`, async () => {
  await renderLeaderboard([])

  await expect
    .element(page.getByText(`No approved brackets yet.`))
    .toBeVisible()
})

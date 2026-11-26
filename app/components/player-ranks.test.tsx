import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { PlayerRanks } from './player-ranks.tsx'
import type { PlayerRank } from '~/leaderboard-row.ts'

const renderRanks = (globalRank: PlayerRank | null) =>
  renderRoutes([
    {
      path: `/`,
      Component: () => (
        <PlayerRanks
          contestId='period-2'
          ranks={[
            {
              kind: `contest`,
              name: `Period 2 Biology`,
              rank: { rank: 6, total: 24 },
            },
            { kind: `global`, name: `Everyone`, rank: globalRank },
          ]}
        />
      ),
    },
    {
      path: `/player/period-2/leaderboards/global`,
      Component: () => <p>Opened</p>,
    },
  ])

test(`each rank opens its leaderboard`, async () => {
  await renderRanks({ rank: 1482, total: 18_530 })
  await expect.element(page.getByText(`of 24 · Top 25%`)).toBeVisible()
  await expectNoAxeViolations()

  await page
    .getByRole(`link`, { name: `Everyone 1,482nd of 18,530 · Top 8%` })
    .click()

  await expect.element(page.getByText(`Opened`)).toBeVisible()
})

test(`a rank in the bottom half has no percentile`, async () => {
  await renderRanks({ rank: 1, total: 1 })

  await expect
    .element(page.getByRole(`link`, { name: `Everyone 1st of 1`, exact: true }))
    .toBeVisible()
})

test(`a leaderboard that leaves the player out has no rank`, async () => {
  await renderRanks(null)

  await expect
    .element(page.getByRole(`link`, { name: `Everyone Not ranked` }))
    .toBeVisible()
})

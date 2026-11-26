import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { SharedContestDetails } from './shared-contest.tsx'
import type { ContestPlayer } from '~/contest-players.server.ts'

const PLAYERS: ContestPlayer[] = [
  {
    id: `ava`,
    displayName: `Ava L.`,
    startedAt: new Date(`2027-03-14T16:05:00Z`),
    status: `APPROVED`,
    score: 12,
  },
]

const renderSharedContest = (isOpen: boolean) =>
  renderRoutes([
    {
      path: `/`,
      Component: () => (
        <SharedContestDetails
          contest={{
            id: `period-2`,
            name: `Period 2 Biology`,
            year: 2027,
            educatorName: `Ms. Frizzle`,
          }}
          players={PLAYERS}
          isOpen={isOpen}
        />
      ),
    },
  ])

test(`a shared contest shows its players and scores without controls`, async () => {
  await renderSharedContest(false)

  await expect
    .element(page.getByRole(`row`, { name: /Ava L\..*12 points/u }))
    .toBeVisible()
  await expect.element(page.getByRole(`button`)).not.toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`a shared contest's leaderboard opens only once the year locks`, async () => {
  await renderSharedContest(true)

  await expect.element(page.getByText(`Ava L.`)).toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: `Leaderboard` }))
    .not.toBeInTheDocument()
})

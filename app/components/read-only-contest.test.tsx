import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { ReadOnlyContest } from './read-only-contest.tsx'
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

const renderContest = (
  isOpen: boolean,
  sharedBy: string | null = `Ms. Frizzle`,
) =>
  renderRoutes([
    {
      path: `/`,
      Component: () => (
        <ReadOnlyContest
          contest={{
            id: `period-2`,
            name: `Period 2 Biology`,
            year: 2027,
          }}
          sharedBy={sharedBy}
          players={PLAYERS}
          isOpen={isOpen}
        />
      ),
    },
  ])

test(`a shared contest shows its players and scores without changing them`, async () => {
  await renderContest(false)

  await expect
    .element(page.getByRole(`row`, { name: /Ava L\..*12 points/u }))
    .toBeVisible()
  expect(
    page
      .getByRole(`button`)
      .elements()
      .map(({ textContent }) => textContent),
  ).toStrictEqual([`Report`])
  await expectNoAxeViolations()
})

test(`a shared contest's leaderboard opens only once the year locks`, async () => {
  await renderContest(true)

  await expect.element(page.getByText(`Ava L.`)).toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: `Leaderboard` }))
    .not.toBeInTheDocument()
})

test(`a past contest of the educator's own has no Report`, async () => {
  await renderContest(false, null)

  await expect.element(page.getByText(`Ava L.`)).toBeVisible()
  await expect.element(page.getByRole(`button`)).not.toBeInTheDocument()
})

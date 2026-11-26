import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { pickEveryBattle } from '../../prisma/pick-every-battle.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { ROUND_1_FIRST, storeTestBracket } from '../../test/picks.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import type { SubmissionStatus } from '../generated/prisma/enums.ts'
import type { Picks } from '../picks.ts'
import { recordResult } from '../results.ts'
import type { Results } from '../results.ts'
import { toSeededBracket } from '../seeded-bracket.ts'
import { listContenders } from '../winners.ts'
import { LockedBracket } from './locked-bracket.tsx'

const STORED_BRACKET = storeTestBracket(BRACKET_2025)
const PICKS = pickEveryBattle(toSeededBracket(STORED_BRACKET))

const renderLocked = async (
  status: SubmissionStatus | null,
  draft: Picks = PICKS,
  results: Results = {},
  isPast = false,
  { isOrphaned = false, hasClearedPicks = false } = {},
) => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <LockedBracket
          year={2025}
          bracket={STORED_BRACKET}
          draft={draft}
          results={results}
          submitted={
            status && {
              submission: {
                status,
                picksChangedAt: new Date(`2026-03-10T21:41:00Z`),
                picks: PICKS,
              },
              personalLink: `https://mmmm.test/my-bracket/secret`,
            }
          }
          isPast={isPast}
          isOrphaned={isOrphaned}
          hasClearedPicks={hasClearedPicks}
          ranks={<p>Ranks</p>}
          forgetPath='/forgotten'
          deletePath='/deleted'
          playerId='maya'
        />
      ),
    },
  ])
}

test.each([
  [
    `APPROVED`,
    `Submissions are closed. Your bracket is in, and your educator approved it`,
  ],
  [
    `PENDING`,
    `Submissions are closed. Your bracket is in, and it counts once your educator approves it`,
  ],
  [
    `REJECTED`,
    `Submissions are closed. Your educator didn’t approve your bracket. You can ask them about it`,
  ],
] as const)(
  `a locked %s bracket says where it stands`,
  async (status, text) => {
    await renderLocked(status)

    await expect.element(page.getByText(text)).toBeVisible()
    await expect.element(page.getByRole(`radio`)).not.toBeInTheDocument()
    await expectNoAxeViolations()
  },
)

test.each([
  [
    `PENDING`,
    `Submissions are closed. Your educator left MMMM, so no one can approve your bracket`,
  ],
  [
    `REJECTED`,
    `Submissions are closed. Your educator didn’t approve your bracket`,
  ],
] as const)(
  `a locked %s bracket of an orphaned contest says nothing of asking the educator`,
  async (status, text) => {
    await renderLocked(status, PICKS, {}, false, { isOrphaned: true })

    await expect.element(page.getByText(text, { exact: true })).toBeVisible()
    await expect
      .element(page.getByText(`tell your educator`, { exact: false }))
      .not.toBeInTheDocument()
  },
)

test.each([
  [
    `submission`,
    `APPROVED`,
    `The bracket changed after submissions closed, so some of your picks were cleared`,
  ],
  [`draft`, null, `The bracket changed, so some of your picks were cleared`],
] as const)(
  `a locked %s that lost picks to a move says so`,
  async (_, status, text) => {
    await renderLocked(status, PICKS, {}, false, { hasClearedPicks: true })

    await expect.element(page.getByText(text, { exact: true })).toBeVisible()
  },
)

test(`changes not submitted before locking are said not to count`, async () => {
  await renderLocked(`APPROVED`, {})

  await expect
    .element(
      page.getByText(
        `The changes you made after submitting weren’t submitted.`,
        {
          exact: false,
        },
      ),
    )
    .toBeVisible()
})

test(`a bracket never submitted is said not to count`, async () => {
  await renderLocked(null)

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(
      `Submissions closed before this bracket was submitted, so it doesn’t count`,
    )
})

test(`deleting a locked bracket warns that it can't be submitted again`, async () => {
  await renderLocked(`APPROVED`)

  await page.getByRole(`button`, { name: `Delete my bracket` }).click()

  await expect
    .element(
      page
        .getByRole(`alertdialog`)
        .getByText(`submissions are closed, so you can’t submit again`, {
          exact: false,
        }),
    )
    .toBeVisible()
})

test(`a submission shows its score so far and marks its picks`, async () => {
  await page.viewport(390, 844)
  await renderLocked(`APPROVED`, PICKS, {
    'ROUND_1:0': PICKS[`ROUND_1:0`]!,
  })

  await expect
    .element(page.getByRole(`heading`, { name: `Score so far` }))
    .toBeVisible()
  await expect
    .element(page.getByText(`1 earned · 137 still possible · 0 missed`))
    .toBeVisible()
  await expect
    .element(
      page.getByRole(`tabpanel`).getByText(/^Round 1, battle 1: .*, right$/u),
    )
    .toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`a phone shows the points by round once pressed`, async () => {
  await page.viewport(390, 844)
  await renderLocked(`APPROVED`)
  const tile = page.getByRole(`listitem`).filter({ hasText: `13 to win` })
  await expect.element(tile).not.toBeInTheDocument()

  await page.getByRole(`button`, { name: `Points by round` }).click()

  await expect.element(tile).toBeVisible()
})

test(`a bracket with a champion has a final score`, async () => {
  await renderLocked(`APPROVED`, PICKS, PICKS)

  await expect
    .element(page.getByRole(`heading`, { name: `Final score` }))
    .toBeVisible()
  await expect.element(page.getByText(`138 earned · 0 missed`)).toBeVisible()
})

test(`a wrong pick names an actual winner who isn't in its box`, async () => {
  await page.viewport(390, 844)
  const bracket = toSeededBracket(STORED_BRACKET)
  const upset = listContenders(bracket, ROUND_1_FIRST)[1]!
  const { results } = recordResult(
    bracket,
    {},
    { round: `ROUND_2`, index: 0 },
    upset.id,
  )
  await renderLocked(`APPROVED`, PICKS, results)

  await page.getByRole(`tab`, { name: `Round 2` }).click()

  await expect
    .element(page.getByRole(`tabpanel`).getByText(`Won by ${upset.name}`))
    .toBeVisible()
})

test(`a bracket never submitted has no score or marks`, async () => {
  await renderLocked(null, PICKS, PICKS)

  await expect
    .element(page.getByRole(`heading`, { name: `Final score` }))
    .not.toBeInTheDocument()
  await expect.element(page.getByText(/, right$/u)).not.toBeInTheDocument()
})

test(`a draft never submitted describes its picks as picks`, async () => {
  await page.viewport(390, 844)
  await renderLocked(null)

  await page.getByRole(`tab`, { name: `Round 1` }).click()

  await expect
    .element(
      page
        .getByRole(`tabpanel`)
        .getByText(/^Round 1, battle 1: .* Picked [^,]+$/u),
    )
    .toBeInTheDocument()
})

test(`a pending bracket of a past year was never approved`, async () => {
  await renderLocked(`PENDING`, PICKS, {}, true)

  await expect
    .element(
      page.getByText(
        `Submissions are closed. Your educator didn’t approve your bracket in time, so it doesn’t count`,
      ),
    )
    .toBeVisible()
})

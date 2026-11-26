import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { pickEveryBattle, storeTestBracket } from '../../test/picks.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import type { SubmissionStatus } from '../generated/prisma/enums.ts'
import type { Picks } from '../picks.ts'
import { toSeededBracket } from '../seeded-bracket.ts'
import { LockedBracket } from './locked-bracket.tsx'

const STORED_BRACKET = storeTestBracket(BRACKET_2025)
const PICKS = pickEveryBattle(toSeededBracket(STORED_BRACKET))

const renderLocked = async (
  status: SubmissionStatus | null,
  draft: Picks = PICKS,
) => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <LockedBracket
          year={2025}
          bracket={STORED_BRACKET}
          draft={draft}
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
    `Submissions are closed. Your bracket is in, and your educator approved it.`,
  ],
  [
    `PENDING`,
    `Submissions are closed. Your bracket is in, and your educator will approve it before it counts.`,
  ],
  [
    `REJECTED`,
    `Submissions are closed. Your educator didn’t approve your bracket. You can ask them about it.`,
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

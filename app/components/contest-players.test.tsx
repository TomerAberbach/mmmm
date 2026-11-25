import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub, useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { ContestPlayer } from '../contest-players.server.ts'
import { freeTextSchema } from '../free-text.ts'
import {
  approvePendingSchema,
  playerNameSchema,
  submissionStatusSchema,
} from '../player-forms.ts'
import { ContestPlayers } from './contest-players.tsx'

const STARTED_AT = new Date(`2027-03-14T16:05:00Z`)

const player = (
  id: string,
  displayName: string,
  status: ContestPlayer[`status`],
): ContestPlayer => ({ id, displayName, startedAt: STARTED_AT, status })

/**
 * Renders the list with actions that change the players in memory, as the
 * routes do, unless `refuseStatus` is set
 */
const renderPlayers = async (
  initialPlayers: ContestPlayer[],
  { refuseStatus = false } = {},
) => {
  let players = initialPlayers
  const update = (id: string, change: Partial<ContestPlayer>) => {
    players = players.map(entry =>
      entry.id === id ? { ...entry, ...change } : entry,
    )
  }
  const Stub = createRoutesStub([
    {
      path: `/contests/period-2`,
      loader: () => players,
      HydrateFallback: () => null,
      Component: () => (
        <ContestPlayers
          contestId='period-2'
          players={useLoaderData<ContestPlayer[]>()}
        />
      ),
    },
    {
      path: `/contests/period-2/players/:playerId/status`,
      action: async ({ request, params }) => {
        if (refuseStatus) {
          return { error: `This bracket is gone or not submitted` }
        }
        const { status } = submissionStatusSchema.parse(
          Object.fromEntries(await request.formData()),
        )
        update(params.playerId!, { status })
        return { ok: true }
      },
    },
    {
      path: `/contests/period-2/players/:playerId/name`,
      action: async ({ request, params }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: playerNameSchema(freeTextSchema),
        })
        if (submission.status === `success`) {
          update(params.playerId!, {
            displayName: submission.value.displayName,
          })
        }
        return { result: submission.reply(), saved: true }
      },
    },
    {
      path: `/contests/period-2/approve-pending`,
      action: async ({ request }) => {
        const { playerIds } = approvePendingSchema.parse(
          Object.fromEntries(await request.formData()),
        )
        for (const id of playerIds) {
          update(id, { status: `APPROVED` })
        }
        return { ok: true }
      },
    },
  ])
  await render(<Stub initialEntries={[`/contests/period-2`]} />)
}

const MAYA = player(`maya`, `Maya R.`, `PENDING`)
const JONAH = player(`jonah`, `Jonah K.`, `PENDING`)
const AVA = player(`ava`, `Ava L.`, `APPROVED`)
const NINJA = player(`ninja`, `Ninja Cat`, `REJECTED`)
const LEO = player(`leo`, `Leo M.`, null)

const section = (name: RegExp) => page.getByRole(`region`, { name })

test(`players are listed in sections by status, each with its count`, async () => {
  await renderPlayers([MAYA, AVA, NINJA, LEO])

  await expect
    .element(page.getByRole(`heading`, { name: `Pending (1)` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`heading`, { name: `Approved (1)` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`heading`, { name: `Rejected (1)` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`heading`, { name: `Started, not submitted (1)` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test.each([
  [`a pending`, MAYA, [`Approve Maya R.`, `Reject Maya R.`]],
  [`an approved`, AVA, [`Reject Ava L.`]],
  [`a rejected`, NINJA, [`Approve Ninja Cat`]],
  [`a draft`, LEO, []],
])(
  `%s player's row offers only the status changes that apply`,
  async (_, entry, labels) => {
    await renderPlayers([entry])

    const buttons = page
      .getByRole(`row`, { name: new RegExp(entry.displayName) })
      .getByRole(`button`)

    await expect
      .poll(() => buttons.elements().map(button => button.ariaLabel))
      .toStrictEqual([...labels, `More for ${entry.displayName}`])
  },
)

test(`approving a player moves them to Approved and focuses the next pending player`, async () => {
  await renderPlayers([MAYA, JONAH, AVA])

  await page.getByRole(`button`, { name: `Approve Maya R.` }).click()

  await expect.element(section(/^Approved/u).getByText(`Maya R.`)).toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Approve Jonah K.` }))
    .toHaveFocus()
  await expect.element(page.getByText(`Approved Maya R.`)).toBeInTheDocument()
})

test(`rejecting the last pending player focuses their row in Rejected`, async () => {
  await renderPlayers([MAYA])

  await page.getByRole(`button`, { name: `Reject Maya R.` }).click()

  await expect
    .element(page.getByRole(`button`, { name: `Approve Maya R.` }))
    .toHaveFocus()
  await expect
    .element(page.getByRole(`heading`, { name: /^Pending/u }))
    .not.toBeInTheDocument()
})

test(`a refused status change leaves the row and says why`, async () => {
  await renderPlayers([MAYA], { refuseStatus: true })

  await page.getByRole(`button`, { name: `Approve Maya R.` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`This bracket is gone or not submitted`)
  await expect.element(section(/^Pending/u).getByText(`Maya R.`)).toBeVisible()
})

test(`approving all asks first, naming the pending players`, async () => {
  await renderPlayers([MAYA, JONAH, AVA])

  await page.getByRole(`button`, { name: `Approve all 2` }).click()

  await expect
    .element(page.getByRole(`alertdialog`))
    .toHaveTextContent(
      `Approve 2 pending brackets?Maya R. and Jonah K. will be approved. You can reject any of them later.CancelApprove all 2`,
    )
})

test(`approving all moves every pending player to Approved`, async () => {
  await renderPlayers([MAYA, JONAH, AVA])
  await page.getByRole(`button`, { name: `Approve all 2` }).click()

  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Approve all 2` })
    .click()

  await expect
    .element(page.getByRole(`heading`, { name: `Approved (3)` }))
    .toHaveFocus()
  await expect
    .element(page.getByRole(`heading`, { name: /^Pending/u }))
    .not.toBeInTheDocument()
})

test(`renaming a player from their menu shows the new name`, async () => {
  await renderPlayers([player(`maya`, `maya r`, `PENDING`)])
  await page.getByRole(`button`, { name: `More for maya r` }).click()
  await page.getByRole(`menuitem`, { name: `Rename` }).click()

  await userEvent.fill(page.getByLabelText(`New name for maya r`), `Maya R.`)
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(page.getByRole(`row`, { name: /Maya R\./u }).getByRole(`status`))
    .toHaveTextContent(`Saved`)
  await expect
    .element(page.getByLabelText(`New name for maya r`))
    .not.toBeInTheDocument()
})

test(`a renamed player's editor stays closed after approving all`, async () => {
  await renderPlayers([player(`jonah`, `Jonah K.`, `PENDING`)])
  await page.getByRole(`button`, { name: `More for Jonah K.` }).click()
  await page.getByRole(`menuitem`, { name: `Rename` }).click()
  await userEvent.fill(
    page.getByLabelText(`New name for Jonah K.`),
    `Jonah Kim`,
  )
  await page.getByRole(`button`, { name: `Save` }).click()
  await expect.element(page.getByText(`Saved`)).toBeVisible()

  await page.getByRole(`button`, { name: `Approve all 1` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Approve all 1` })
    .click()

  await expect
    .element(page.getByRole(`heading`, { name: `Approved (1)` }))
    .toHaveFocus()
  await expect
    .element(page.getByLabelText(/^New name for/u))
    .not.toBeInTheDocument()
})

test(`a contest without players says to share its link`, async () => {
  await renderPlayers([])

  await expect
    .element(
      page.getByText(
        `No one has started a bracket yet. Share the contest link with your players.`,
      ),
    )
    .toBeVisible()
})

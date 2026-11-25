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
      path: `/contests/period-2/players/status`,
      action: async ({ request }) => {
        if (refuseStatus) {
          return { error: `This bracket is gone or not submitted` }
        }
        const { playerIds, status } = submissionStatusSchema.parse(
          Object.fromEntries(await request.formData()),
        )
        for (const id of playerIds) {
          update(id, { status })
        }
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

// `user-event` writes keys in braces
// eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation
const ESCAPE = `{Escape}`

const selectPlayer = (name: string) =>
  page.getByRole(`checkbox`, { name: `Select ${name}` }).click({ force: true })

const selectionBar = page.getByRole(`group`, { name: `Selected brackets` })

const readBarLabels = () =>
  selectionBar
    .getByRole(`button`)
    .elements()
    .map(button => button.textContent)

test(`selecting players across sections counts what each decision changes`, async () => {
  await renderPlayers([MAYA, JONAH, AVA])

  await selectPlayer(`Maya R.`)
  await selectPlayer(`Jonah K.`)
  await selectPlayer(`Ava L.`)

  await expect
    .poll(readBarLabels)
    .toStrictEqual([`Clear`, `Approve 2`, `Reject 3`])
  await expectNoAxeViolations()
})

test(`a decision that changes none of the selection is left out`, async () => {
  await renderPlayers([MAYA, AVA])

  await selectPlayer(`Ava L.`)

  await expect.poll(readBarLabels).toStrictEqual([`Clear`, `Reject 1`])
})

test(`a draft can't be selected`, async () => {
  await renderPlayers([LEO])

  await expect.element(page.getByText(`Leo M.`)).toBeVisible()
  await expect.element(page.getByRole(`checkbox`)).not.toBeInTheDocument()
})

test(`a section's checkbox selects only that section`, async () => {
  await renderPlayers([MAYA, JONAH, AVA])

  await page
    .getByRole(`checkbox`, { name: `Select all pending` })
    .click({ force: true })

  await expect.element(selectionBar.getByText(`2 selected`)).toBeVisible()
  await expect
    .element(page.getByRole(`checkbox`, { name: `Select Ava L.` }))
    .not.toBeChecked()
})

test(`approving a selection moves it, clears it, and focuses the section it moved to`, async () => {
  await renderPlayers([MAYA, JONAH, AVA])
  await selectPlayer(`Maya R.`)
  await selectPlayer(`Ava L.`)

  await selectionBar.getByRole(`button`, { name: `Approve 1` }).click()

  await expect
    .element(page.getByRole(`heading`, { name: `Approved (2)` }))
    .toHaveFocus()
  await expect.element(page.getByText(`Approved 1 bracket`)).toBeInTheDocument()
  await expect.element(selectionBar).not.toBeInTheDocument()
})

test(`a refused decision keeps the selection and says why`, async () => {
  await renderPlayers([MAYA], { refuseStatus: true })
  await selectPlayer(`Maya R.`)

  await selectionBar.getByRole(`button`, { name: `Reject 1` }).click()

  await expect
    .element(selectionBar.getByRole(`alert`))
    .toHaveTextContent(`This bracket is gone or not submitted`)
  await expect.element(selectionBar.getByText(`1 selected`)).toBeVisible()
})

test(`a refused decision's error goes once the selection changes`, async () => {
  await renderPlayers([MAYA, JONAH], { refuseStatus: true })
  await selectPlayer(`Maya R.`)
  await selectionBar.getByRole(`button`, { name: `Reject 1` }).click()
  await expect.element(selectionBar.getByRole(`alert`)).toBeVisible()

  await selectPlayer(`Jonah K.`)

  await expect.element(selectionBar.getByRole(`alert`)).not.toBeInTheDocument()
})

test(`rows' own decisions are off while any row is selected`, async () => {
  await renderPlayers([MAYA, JONAH])

  await selectPlayer(`Maya R.`)

  await expect
    .element(page.getByRole(`button`, { name: `Approve Jonah K.` }))
    .toBeDisabled()
  await expect
    .element(page.getByRole(`button`, { name: `Approve all 2` }))
    .toBeDisabled()
})

test(`Escape clears the selection`, async () => {
  await renderPlayers([MAYA])
  await selectPlayer(`Maya R.`)

  await userEvent.keyboard(ESCAPE)

  await expect.element(selectionBar).not.toBeInTheDocument()
})

test(`Escape in a rename cancels it and keeps the selection`, async () => {
  await renderPlayers([MAYA])
  await selectPlayer(`Maya R.`)
  await page.getByRole(`button`, { name: `More for Maya R.` }).click()
  await page.getByRole(`menuitem`, { name: `Rename` }).click()
  await expect
    .element(page.getByLabelText(`New name for Maya R.`))
    .toHaveFocus()

  await userEvent.keyboard(ESCAPE)

  await expect
    .element(page.getByLabelText(`New name for Maya R.`))
    .not.toBeInTheDocument()
  await expect.element(selectionBar).toBeVisible()
})

test(`Escape in a menu closes it and keeps the selection`, async () => {
  await renderPlayers([MAYA])
  await selectPlayer(`Maya R.`)
  await page.getByRole(`button`, { name: `More for Maya R.` }).click()
  await expect.element(page.getByRole(`menu`)).toBeVisible()

  await userEvent.keyboard(ESCAPE)

  await expect.element(page.getByRole(`menu`)).not.toBeInTheDocument()
  await expect.element(selectionBar).toBeVisible()
})

test(`clearing the selection focuses its first player's checkbox`, async () => {
  await renderPlayers([AVA, JONAH])
  await selectPlayer(`Ava L.`)
  await selectPlayer(`Jonah K.`)

  await selectionBar.getByRole(`button`, { name: `Clear` }).click()

  await expect
    .element(page.getByRole(`checkbox`, { name: `Select Jonah K.` }))
    .toHaveFocus()
})

test(`a possible duplicate's note links to the other player`, async () => {
  await renderPlayers([MAYA, player(`maya-2`, `maya r`, `APPROVED`)])

  await page
    .getByRole(`row`, { name: /Maya R\./u })
    .getByRole(`link`, { name: `maya r` })
    .click()

  await expect
    .element(section(/^Approved/u).getByRole(`row`, { name: /maya r/u }))
    .toHaveFocus()
})

test(`a note names every possible duplicate`, async () => {
  await renderPlayers([
    MAYA,
    player(`maya-2`, `maya r`, `PENDING`),
    player(`maya-3`, `MayaR`, `PENDING`),
  ])

  await expect
    .element(page.getByText(`This might be the same as maya r and MayaR`))
    .toBeVisible()
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

import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { formatDateTime, formatLocalDate } from '../dates.ts'
import { idsSchema } from '../id-list.ts'
import { ContestTrash } from './contest-trash.tsx'
import type { DeletedPlayer } from '~/trash.server.ts'

const DELETED_AT = new Date(`2027-03-15T15:40:00Z`)
const SEVEN_DAYS_LATER = new Date(`2027-03-22T15:40:00Z`)

const MAYA: DeletedPlayer = {
  id: `maya`,
  displayName: `Maya R.`,
  status: `APPROVED`,
  deletedAt: DELETED_AT,
  deletedBy: `EDUCATOR`,
}
const LEO: DeletedPlayer = {
  id: `leo`,
  displayName: `Leo M.`,
  status: null,
  deletedAt: DELETED_AT,
  deletedBy: `PLAYER`,
}

/** The actions take the players out of the trash, unless `refuse` is set */
const renderTrash = async (
  initialPlayers: DeletedPlayer[],
  { refuse = false, isOpen = true } = {},
) => {
  let players = initialPlayers
  const remove = async (request: Request) => {
    if (refuse) {
      return { error: `Nothing was restored` }
    }
    const { ids } = idsSchema.parse(
      Object.fromEntries(await request.formData()),
    )
    players = players.filter(({ id }) => !ids.includes(id))
    return { ok: true }
  }
  await renderRoutes(
    [
      {
        path: `/contests/period-2/trash`,
        loader: () => players,
        HydrateFallback: () => null,
        Component: () => (
          <ContestTrash
            contest={{
              id: `period-2`,
              name: `Period 2 Biology`,
              year: 2027,
              link: `https://mmmm.onl/play/secret`,
            }}
            isOpen={isOpen}
            players={useLoaderData<DeletedPlayer[]>()}
          />
        ),
      },
      {
        path: `/contests/period-2/trash/restore`,
        action: ({ request }) => remove(request),
      },
      {
        path: `/contests/period-2/trash/erase`,
        action: ({ request }) => remove(request),
      },
    ],
    `/contests/period-2/trash`,
  )
}

const row = (name: string) =>
  page.getByRole(`listitem`).filter({ hasText: name })

const confirm = (label: string) =>
  page.getByRole(`alertdialog`).getByRole(`button`, { name: label }).click()

test(`a row says who deleted a player and when`, async () => {
  await renderTrash([MAYA])

  await expect
    .element(row(`Maya R.`).getByText(`Maya R. · Approved`))
    .toBeVisible()
  await expect
    .element(
      row(`Maya R.`).getByText(`Deleted by you, ${formatDateTime(DELETED_AT)}`),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a player's own deletion says when it's erased`, async () => {
  await renderTrash([LEO])

  await expect
    .element(
      row(`Leo M.`).getByText(
        `Deleted by player, ${formatDateTime(DELETED_AT)}. Erased for good ${formatLocalDate(SEVEN_DAYS_LATER)}`,
      ),
    )
    .toBeVisible()
})

test(`a draft in a locked year is said to be never submitted`, async () => {
  await renderTrash([LEO], { isOpen: false })

  await expect
    .element(row(`Leo M.`).getByText(`Leo M. · Never submitted`))
    .toBeVisible()
})

test(`restoring a player removes their row and focuses the next one`, async () => {
  await renderTrash([MAYA, LEO])

  await page.getByRole(`button`, { name: `Restore Maya R.` }).click()

  await expect
    .element(page.getByRole(`button`, { name: `Restore Leo M.` }))
    .toHaveFocus()
  await expect.element(page.getByText(`Restored Maya R.`)).toBeInTheDocument()
})

test(`restoring the last player focuses the empty trash`, async () => {
  await renderTrash([MAYA])

  await page.getByRole(`button`, { name: `Restore Maya R.` }).click()

  await expect.element(page.getByText(`The trash is empty`)).toHaveFocus()
})

test(`deleting a player forever asks first`, async () => {
  await renderTrash([MAYA, LEO])
  await page.getByRole(`button`, { name: `Delete forever: Maya R.` }).click()
  await expect
    .element(page.getByRole(`alertdialog`))
    .toHaveTextContent(
      `Delete Maya R.’s bracket forever?You can’t undo this. Backups keep deleted data for up to 30 days.CancelDelete forever`,
    )

  await confirm(`Delete forever`)

  await expect.element(row(`Maya R.`)).not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`button`, { name: `Restore Leo M.` }))
    .toHaveFocus()
})

test(`emptying the trash asks first, counting the brackets`, async () => {
  await renderTrash([MAYA, LEO])
  await page.getByRole(`button`, { name: `Empty trash` }).click()

  await confirm(`Delete 2 brackets forever`)

  await expect.element(page.getByText(`The trash is empty`)).toHaveFocus()
})

test(`a refused restore leaves the row and says why`, async () => {
  await renderTrash([MAYA], { refuse: true })

  await page.getByRole(`button`, { name: `Restore Maya R.` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`Nothing was restored`)
  await expect.element(row(`Maya R.`)).toBeVisible()
})

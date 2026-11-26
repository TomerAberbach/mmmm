import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { AdminPlayerList } from './admin-player-list.tsx'
import type { AdminPlayer } from '~/admin-contests.server.ts'

/** The action erases the player, and the loader reads the rest back */
const renderPlayers = async () => {
  let players: AdminPlayer[] = [
    { id: `maya`, displayName: `Maya R.`, isInTrash: false },
    { id: `sam`, displayName: `Sam T.`, isInTrash: true },
  ]
  await renderRoutes([
    {
      path: `/`,
      loader: () => players,
      HydrateFallback: () => null,
      Component: () => (
        <AdminPlayerList
          players={useLoaderData<AdminPlayer[]>()}
          action='/erase'
        />
      ),
    },
    {
      path: `/erase`,
      action: async ({ request }) => {
        const playerId = (await request.formData()).get(`playerId`)
        players = players.filter(({ id }) => id !== playerId)
        return { ok: true }
      },
    },
  ])
}

test(`the admin erases a player`, async () => {
  await renderPlayers()
  await expect.element(page.getByText(`In the trash`)).toBeVisible()
  await expectNoAxeViolations()

  await page.getByRole(`button`, { name: `Delete forever: Maya R.` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Delete forever` })
    .click()

  await expect.element(page.getByText(`Maya R.`)).not.toBeInTheDocument()
  await expect.element(page.getByText(`Sam T.`)).toBeVisible()
})

test(`erasing a player in the trash changes no leaderboard or link`, async () => {
  await renderPlayers()

  await page.getByRole(`button`, { name: `Delete forever: Sam T.` }).click()

  await expect
    .element(
      page
        .getByRole(`alertdialog`)
        .getByText(
          `This can’t be undone, though backups keep the data for up to 30 days.`,
          { exact: true },
        ),
    )
    .toBeVisible()
})

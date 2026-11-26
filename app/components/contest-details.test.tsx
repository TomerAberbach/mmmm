import { parseWithZod } from '@conform-to/zod/v4'
import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { contestNameSchema } from '../contest-forms.ts'
import { freeTextSchema } from '../free-text.ts'
import { ContestDetails } from './contest-details.tsx'
import type { ContestPlayer } from '~/contest-players.server.ts'
import type { Contest } from '~/contests.server.ts'

const STARTED_AT = new Date(`2027-03-14T16:05:00Z`)

const PLAYERS: ContestPlayer[] = [
  {
    id: `maya`,
    displayName: `Maya R.`,
    startedAt: STARTED_AT,
    status: `PENDING`,
  },
  { id: `leo`, displayName: `Leo M.`, startedAt: STARTED_AT, status: null },
]

/** The action saves the name, and the loader reads it back */
const renderContest = async () => {
  let contest: Contest = {
    id: `period-2`,
    name: `Period 2 Biology`,
    year: 2027,
    link: `https://mmmm.onl/play/secret`,
  }
  await renderRoutes(
    [
      {
        path: `/contests/period-2`,
        loader: () => contest,
        HydrateFallback: () => null,
        Component: () => (
          <ContestDetails
            contest={useLoaderData<Contest>()}
            players={PLAYERS}
            deletedCount={2}
          />
        ),
      },
      {
        path: `/contests/period-2/link`,
        action: () => {
          contest = { ...contest, link: `https://mmmm.onl/play/new-secret` }
          return { ok: true }
        },
      },
      {
        path: `/contests/period-2/name`,
        action: async ({ request }) => {
          const submission = parseWithZod(await request.formData(), {
            schema: contestNameSchema(freeTextSchema),
          })
          if (submission.status === `success`) {
            contest = { ...contest, name: submission.value.name }
          }
          return { result: submission.reply(), saved: true }
        },
      },
    ],
    `/contests/period-2`,
  )
}

test(`the contest link is shown beside its Copy button`, async () => {
  await renderContest()

  await expect
    .element(page.getByRole(`textbox`, { name: `Contest link` }))
    .toHaveValue(`https://mmmm.onl/play/secret`)
  await expect
    .element(page.getByRole(`button`, { name: `Copy link` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`the contest link's QR code shows on request`, async () => {
  await renderContest()

  await page.getByText(`Show a QR code`).click()

  await expect
    .element(page.getByRole(`img`, { name: `QR code for the contest link` }))
    .toBeVisible()
})

test(`renaming a contest shows its new name`, async () => {
  await renderContest()
  await page.getByRole(`button`, { name: `Rename` }).click()

  await userEvent.fill(page.getByLabelText(`Contest name`), `Period 3 Biology`)
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(page.getByRole(`heading`, { name: `Period 3 Biology` }))
    .toBeVisible()
  await expect.element(page.getByText(`Saved the contest name`)).toBeVisible()
})

test(`Escape closes the contest's name without saving`, async () => {
  await renderContest()
  await page.getByRole(`button`, { name: `Rename` }).click()
  await userEvent.fill(page.getByLabelText(`Contest name`), `Period 3 Biology`)

  // eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- userEvent's key syntax
  await userEvent.keyboard(`{Escape}`)

  await expect
    .element(page.getByLabelText(`Contest name`))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`heading`, { name: `Period 2 Biology` }))
    .toBeVisible()
})

test(`deleting a contest asks first, counting its submissions and drafts`, async () => {
  await renderContest()

  await page.getByRole(`button`, { name: `Delete contest` }).click()

  await expect
    .element(page.getByRole(`alertdialog`))
    .toHaveTextContent(
      `Delete Period 2 Biology?Its 1 submission and 1 draft go with it, and its contest link and personal links stop working. You can restore it until next year’s bracket is published.CancelDelete contest`,
    )
})

test(`the contest page links its trash`, async () => {
  await renderContest()

  await expect
    .element(page.getByRole(`link`, { name: `Trash (2)` }))
    .toHaveAttribute(`href`, `/contests/period-2/trash`)
})

test(`a new contest link shows in place of the old one after confirming`, async () => {
  await renderContest()
  await page.getByRole(`button`, { name: `New contest link` }).click()
  await expect
    .element(page.getByRole(`alertdialog`))
    .toHaveTextContent(
      `Replace the contest link?The old link stops working, so share the new one with your players. Players who already started keep their personal links.CancelCreate new link`,
    )

  await page.getByRole(`button`, { name: `Create new link` }).click()

  await expect
    .element(page.getByRole(`textbox`, { name: `Contest link` }))
    .toHaveValue(`https://mmmm.onl/play/new-secret`)
  await expect
    .element(
      page.getByText(`Created a new contest link. The old one no longer works`),
    )
    .toBeVisible()
})

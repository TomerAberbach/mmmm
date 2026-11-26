import { parseWithZod } from '@conform-to/zod/v4'
import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { shareSchema } from '../share-forms.ts'
import { ContestShares } from './contest-shares.tsx'
import type { Colleague } from '~/shares.server.ts'

/** The actions share and stop sharing, and the loader reads the shares back */
const renderShares = async () => {
  let colleagues: Colleague[] = []
  await renderRoutes(
    [
      {
        path: `/contests/period-2`,
        loader: () => colleagues,
        HydrateFallback: () => null,
        Component: () => (
          <ContestShares
            contest={{ id: `period-2`, name: `Period 2 Biology` }}
            colleagues={useLoaderData<Colleague[]>()}
          />
        ),
      },
      {
        path: `/contests/period-2/shares`,
        action: async ({ request }) => {
          const submission = parseWithZod(await request.formData(), {
            schema: shareSchema,
          })
          if (submission.status !== `success`) {
            return { result: submission.reply() }
          }
          const { email } = submission.value
          if (email === `stranger@example.com`) {
            return {
              result: submission.reply({ fieldErrors: { email: [`No one`] } }),
            }
          }
          colleagues = [{ id: `ruhle`, name: `Mr. Ruhle`, email }]
          return { result: submission.reply({ resetForm: true }), saved: true }
        },
      },
      {
        path: `/contests/period-2/shares/stop`,
        action: async ({ request }) => {
          const id = (await request.formData()).get(`colleagueId`)
          colleagues = colleagues.filter(colleague => colleague.id !== id)
          return { ok: true }
        },
      },
    ],
    `/contests/period-2`,
  )
}

const share = async (email: string) => {
  await page.getByLabelText(`Colleague’s email address`).fill(email)
  await page.getByRole(`button`, { name: `Share contest` }).click()
}

test(`sharing lists the colleague and empties the form`, async () => {
  await renderShares()

  await share(`ruhle@example.com`)

  await expect.element(page.getByText(`Mr. Ruhle`)).toBeVisible()
  await expect
    .element(page.getByLabelText(`Colleague’s email address`))
    .toHaveValue(``)
  await expect.element(page.getByText(`Shared the contest`)).toBeVisible()
  await expectNoAxeViolations()
})

test(`an address without a colleague shows why`, async () => {
  await renderShares()

  await share(`stranger@example.com`)

  await expect.element(page.getByText(`No one`)).toBeVisible()
})

test(`stopping takes the colleague off the list once confirmed`, async () => {
  await renderShares()
  await share(`ruhle@example.com`)

  await page
    .getByRole(`button`, { name: `Stop sharing with Mr. Ruhle` })
    .click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Stop sharing` })
    .click()

  await expect.element(page.getByText(`Mr. Ruhle`)).not.toBeInTheDocument()
})

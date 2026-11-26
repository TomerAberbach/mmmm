import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { ReportList } from './report-list.tsx'
import type { ReportItem } from '~/reports.server.ts'

const REPORT: ReportItem = {
  id: `report`,
  contest: { id: `period-2`, name: `Period 2 Biology`, year: 2027 },
  educatorName: `Ms. Frizzle`,
  player: { id: `ninja`, displayName: `Ninja Cat` },
  reason: `RUDE`,
  createdAt: new Date(`2027-03-20T16:05:00Z`),
}

test(`dismissing a report takes it off the list and keeps focus there`, async () => {
  let reports = [REPORT, { ...REPORT, id: `contest`, player: null }]
  await renderRoutes([
    {
      path: `/`,
      loader: () => reports,
      HydrateFallback: () => null,
      Component: () => (
        <ReportList
          reports={useLoaderData<ReportItem[]>()}
          dismissPath='/dismiss'
          toLink={() => ({ to: `/contest`, label: `See the contest` })}
        />
      ),
    },
    {
      path: `/dismiss`,
      action: async ({ request }) => {
        const id = (await request.formData()).get(`id`)
        reports = reports.filter(report => report.id !== id)
        return { ok: true }
      },
    },
  ])
  await expect
    .element(page.getByText(/The contest’s name · Ms\. Frizzle/u))
    .toBeVisible()
  await expectNoAxeViolations()

  await page
    .getByRole(`button`, {
      name: `Dismiss the report about Ninja Cat: Rude or hurtful`,
    })
    .click()

  await expect.element(page.getByText(`Ninja Cat`)).not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`region`, { name: `Reports` }))
    .toHaveFocus()
})

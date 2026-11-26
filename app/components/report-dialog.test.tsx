import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { ReportDialog } from './report-dialog.tsx'
import type { ReportTarget } from '~/report-forms.ts'

const PLAYERS: [ReportTarget, ...ReportTarget[]] = [
  { id: `priya`, label: `1st · Priya S.` },
  { id: `ninja`, label: `2nd · Ninja Cat` },
]

/** Resolves to the reports the action received */
const renderDialog = async (
  targets: [ReportTarget, ...ReportTarget[]],
  error?: string,
) => {
  const reports: Record<string, unknown>[] = []
  await renderRoutes([
    {
      path: `/`,
      Component: () => <ReportDialog action='/report' targets={targets} />,
    },
    {
      path: `/report`,
      action: async ({ request }) => {
        reports.push(Object.fromEntries(await request.formData()))
        return error === undefined ? { ok: true } : { error }
      },
    },
  ])
  await page.getByRole(`button`, { name: `Report` }).click()
  return reports
}

test(`a report names the chosen row and reason`, async () => {
  const reports = await renderDialog(PLAYERS)
  await expectNoAxeViolations()

  await page
    .getByRole(`button`, { name: /What do you want to report/u })
    .click()
  await page.getByRole(`option`, { name: `2nd · Ninja Cat` }).click()
  await page.getByText(`Rude or hurtful`).click()
  await page.getByRole(`button`, { name: `Send report` }).click()

  await expect
    .element(page.getByText(`Thanks. Your report was sent`))
    .toBeVisible()
  expect(reports).toStrictEqual([{ target: `ninja`, reason: `RUDE` }])
})

test(`a report needs a reason`, async () => {
  const reports = await renderDialog(PLAYERS)

  await page.getByRole(`button`, { name: `Send report` }).click()

  await expect
    .element(page.getByText(`Choose what’s wrong with it`))
    .toBeVisible()
  expect(reports).toStrictEqual([])
})

test(`a refused report says why`, async () => {
  await renderDialog(
    [{ id: `contest`, label: `The contest’s name` }],
    `Too many reports right now`,
  )

  await page.getByText(`Something else`).click()
  await page.getByRole(`button`, { name: `Send report` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`Too many reports right now`)
})

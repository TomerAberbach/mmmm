import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { DeleteOrganizationDialog } from './delete-organization-dialog.tsx'

test(`deleting an organization's data says how much goes and asks for its domain`, async () => {
  const received: unknown[] = []
  await renderRoutes([
    {
      path: `/`,
      Component: () => <DeleteOrganizationDialog domain='springfield.edu' />,
    },
    {
      path: `/admin/organizations/data`,
      loader: () => ({ educatorCount: 4, contestCount: 11, playerCount: 260 }),
    },
    {
      path: `/admin/organizations/delete`,
      action: async ({ request }) => {
        received.push(Object.fromEntries(await request.formData()))
        return { result: {}, saved: true }
      },
    },
  ])
  await page
    .getByRole(`button`, { name: `Delete data from springfield.edu` })
    .click()
  await expect
    .element(
      page.getByText(
        /4 accounts, 11 contests, and 260 brackets, past years included/u,
      ),
    )
    .toBeVisible()
  await expectNoAxeViolations()

  await page
    .getByLabelText(`Type springfield.edu to confirm`)
    .fill(`springfield.edu`)
  await page.getByRole(`button`, { name: `Delete all data` }).click()

  await expect
    .poll(() => received)
    .toStrictEqual([
      { domain: `springfield.edu`, confirmation: `springfield.edu` },
    ])
})

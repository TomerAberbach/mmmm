import { parseWithZod } from '@conform-to/zod/v4'
import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { organizationRenameSchema } from '../organization-forms.ts'
import type { OrganizationRow } from '../organizations.server.ts'
import { OrganizationList } from './organization-list.tsx'

test(`an unnamed organization is renamed in place`, async () => {
  let name: string | null = null
  await renderRoutes([
    {
      path: `/`,
      loader: (): OrganizationRow[] => [
        { domain: `walkerville.edu`, name, educatorCount: 1 },
      ],
      HydrateFallback: () => null,
      Component: () => (
        <OrganizationList organizations={useLoaderData<OrganizationRow[]>()} />
      ),
    },
    {
      path: `/admin/organizations/rename`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: organizationRenameSchema,
        })
        if (submission.status === `success`) {
          ;({ name } = submission.value)
        }
        return { result: submission.reply(), saved: true }
      },
    },
  ])
  await expect.element(page.getByText(`Not named yet`)).toBeVisible()
  await expect
    .element(page.getByText(`walkerville.edu · 1 educator`))
    .toBeVisible()
  await expectNoAxeViolations()

  await page.getByRole(`button`, { name: `Rename walkerville.edu` }).click()
  await page
    .getByLabelText(`New name for walkerville.edu`)
    .fill(`Walkerville Elementary`)
  await page.getByRole(`button`, { name: `Save` }).click()

  await expect
    .element(
      page.getByRole(`button`, { name: `Rename Walkerville Elementary` }),
    )
    .toBeVisible()
})

import { useLoaderData } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { AdminContestList } from './admin-contest-list.tsx'
import type { AdminContest } from '~/admin-contests.server.ts'

const CONTEST: AdminContest = {
  id: `period-2`,
  name: `Period 2 Biology`,
  educatorName: `Ms. Frizzle`,
  organizationName: null,
  year: 2027,
  approvedCount: 24,
  isHidden: false,
  isInTrash: false,
}

/** The action hides and shows the contest, and the loader reads it back */
const renderContests = async () => {
  let isHidden = false
  await renderRoutes([
    {
      path: `/`,
      loader: () => isHidden,
      HydrateFallback: () => null,
      Component: () => {
        const contest = { ...CONTEST, isHidden: useLoaderData<boolean>() }
        return <AdminContestList contests={[contest]} />
      },
    },
    {
      path: `/admin/contests/hidden`,
      action: async ({ request }) => {
        isHidden = (await request.formData()).get(`isHidden`) === `true`
        return { ok: true }
      },
    },
  ])
}

const press = async (label: string) => {
  await page.getByRole(`button`, { name: `${label} Period 2 Biology` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `${label} contest` })
    .click()
}

test(`the admin hides a contest and shows it again`, async () => {
  await renderContests()
  await expect
    .element(page.getByText(`2027 · Ms. Frizzle · 24 approved`))
    .toBeVisible()

  await press(`Hide`)
  await expect
    .element(page.getByText(`Hidden · 2027 · Ms. Frizzle · 24 approved`))
    .toBeVisible()
  await expectNoAxeViolations()

  await press(`Show`)
  await expect
    .element(
      page.getByText(`2027 · Ms. Frizzle · 24 approved`, { exact: true }),
    )
    .toBeVisible()
})

test(`a contest in the trash opens but can't be hidden or handed over`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <AdminContestList
          contests={[{ ...CONTEST, educatorName: null, isInTrash: true }]}
        />
      ),
    },
  ])

  await expect
    .element(page.getByText(`In the trash · 2027 · No educator · 24 approved`))
    .toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: `Period 2 Biology` }))
    .toHaveAttribute(`href`, `/admin/contests/period-2`)
  await expect.element(page.getByRole(`button`)).not.toBeInTheDocument()
})

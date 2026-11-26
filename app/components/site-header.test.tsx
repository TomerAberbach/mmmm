import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { SiteHeader } from './site-header.tsx'

test(`the wordmark links to the home page`, async () => {
  await renderRoutes([{ path: `/`, Component: SiteHeader }])

  await expect
    .element(page.getByRole(`link`, { name: `MMMM` }))
    .toHaveAttribute(`href`, `/`)
  await expectNoAxeViolations()
})

test(`a signed-in educator's name links to their settings`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <SiteHeader educator={{ name: `Ms. Frizzle`, reportCount: 0 }} />
      ),
    },
  ])

  await expect
    .element(page.getByRole(`link`, { name: `Ms. Frizzle` }))
    .toHaveAttribute(`href`, `/settings`)
  await expectNoAxeViolations()
})

test(`an educator with reports sees how many`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <SiteHeader educator={{ name: `Ms. Frizzle`, reportCount: 2 }} />
      ),
    },
  ])

  await expect
    .element(page.getByRole(`link`, { name: `Reports (2)` }))
    .toHaveAttribute(`href`, `/contests/reports`)
})

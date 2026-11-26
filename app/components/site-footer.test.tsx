import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { SiteFooter } from './site-footer.tsx'

test(`the footer links the support email and privacy policy`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => <SiteFooter supportEmail='help@example.com' />,
    },
  ])

  await expect
    .element(page.getByRole(`link`, { name: `help@example.com` }))
    .toHaveAttribute(`href`, `mailto:help@example.com`)
  await expect
    .element(page.getByRole(`link`, { name: `Privacy policy` }))
    .toHaveAttribute(`href`, `/privacy`)
  await expectNoAxeViolations()
})

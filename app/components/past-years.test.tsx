import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { PastYearBanner } from './past-year-banner.tsx'
import { PastYears } from './past-years.tsx'

test(`each past year shows its champion and opens its contests`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <PastYears
          years={[
            {
              year: 2026,
              champion: `Spotted hyena`,
              contests: [
                {
                  id: `period-2`,
                  name: `Period 2 Biology`,
                  sharedBy: null,
                  submissionCount: 24,
                },
              ],
            },
            { year: 2025, champion: null, contests: [] },
          ]}
        />
      ),
    },
    { path: `/contests/period-2`, Component: () => <p>Opened</p> },
  ])
  await expect.element(page.getByText(`Spotted hyena`)).toBeVisible()
  await expect.element(page.getByText(`24 submissions`)).toBeVisible()
  await expect
    .element(page.getByRole(`region`, { name: `2025` }))
    .toHaveTextContent(`2025Bracket and leaderboards`)
  await expectNoAxeViolations()

  await page.getByRole(`link`, { name: `Period 2 Biology` }).click()

  await expect.element(page.getByText(`Opened`)).toBeVisible()
})

test(`a past year's banner links to the current year`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <PastYearBanner
          pastYear={{ year: 2026, currentYear: 2027 }}
          currentPath='/contests'
        />
      ),
    },
  ])

  await expect.element(page.getByText(`2026 is over.`)).toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: `Go to 2027` }))
    .toHaveAttribute(`href`, `/contests`)
  await expectNoAxeViolations()
})

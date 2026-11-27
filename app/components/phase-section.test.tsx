import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { PhaseSection } from './phase-section.tsx'

test(`a complete year says how many results are saved`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <PhaseSection
          year={2026}
          summary={{ phase: `COMPLETE`, champion: `Lions`, resultCount: 62 }}
        />
      ),
    },
  ])

  await expect
    .element(
      page.getByText(`Lions won, and 62 of 64 results are saved.`, {
        exact: false,
      }),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a bracket whose tournament is over can't be published`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <PhaseSection
          year={2027}
          summary={{ phase: `SETUP`, expectedLockDate: null }}
          isOver
        />
      ),
    },
  ])

  await expect
    .element(
      page.getByText(`Its tournament is over, so it can’t be published.`, {
        exact: false,
      }),
    )
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Publish 2027 bracket` }))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`button`, { name: `Save date` }))
    .not.toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`publishing says how many of the archived year's results are saved`, async () => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <PhaseSection
          year={2027}
          summary={{ phase: `SETUP`, expectedLockDate: null }}
          archivedYear={{ year: 2026, resultCount: 62 }}
        />
      ),
    },
  ])

  await page.getByRole(`button`, { name: `Publish 2027 bracket` }).click()

  await expect
    .element(
      page.getByText(
        `2026 becomes read-only, and 62 of 64 results are saved.`,
        { exact: false },
      ),
    )
    .toBeVisible()
})

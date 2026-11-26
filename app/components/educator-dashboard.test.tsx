import { redirect, useParams } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { EducatorDashboard } from './educator-dashboard.tsx'
import type { EducatorDashboardView } from './educator-dashboard.tsx'

const CONTESTS = [
  { id: `period-2`, name: `Period 2 Biology`, link: `https://mmmm.onl/play/a` },
  { id: `period-5`, name: `Period 5 Biology`, link: `https://mmmm.onl/play/b` },
]

/** The action creates the contest under its own name as the ID */
const renderDashboard = async (view: EducatorDashboardView) => {
  await renderRoutes(
    [
      { path: `/contests`, Component: () => <EducatorDashboard view={view} /> },
      {
        path: `/contests/new`,
        action: async ({ request }) =>
          redirect(
            `/contests/${new URLSearchParams(await request.text()).get(`name`) ?? ``}`,
          ),
      },
      {
        path: `/contests/:contestId`,
        Component: () => <p>Opened {useParams().contestId}</p>,
      },
    ],
    `/contests`,
  )
}

test(`before any bracket is published, the educator dashboard says when contests open`, async () => {
  await renderDashboard({ current: null, upcomingYear: 2027 })

  await expect
    .element(
      page.getByRole(`heading`, { name: `The 2027 bracket isn’t ready yet` }),
    )
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Create contest` }))
    .not.toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`an educator without contests is offered one way to create the first`, async () => {
  await renderDashboard({
    current: { year: 2027, isLocked: false, contests: [], deletedCount: 0 },
  })

  await expect
    .element(page.getByRole(`heading`, { name: `Start your first contest` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Create contest` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`each contest links to its page and offers its contest link`, async () => {
  await renderDashboard({
    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      deletedCount: 0,
    },
  })

  await page.getByRole(`link`, { name: `Period 5 Biology` }).click()

  await expect.element(page.getByText(`Opened period-5`)).toBeVisible()
})

test(`the contest list passes accessibility checks`, async () => {
  await renderDashboard({
    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      deletedCount: 0,
    },
  })

  await expect
    .element(
      page.getByRole(`button`, {
        name: `Copy link for Period 2 Biology`,
      }),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`creating a contest opens its page`, async () => {
  await renderDashboard({
    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      deletedCount: 0,
    },
  })
  await page.getByRole(`button`, { name: `Create contest` }).click()

  await userEvent.fill(
    page.getByRole(`dialog`).getByLabelText(`Contest name`),
    `Science Club`,
  )
  await page
    .getByRole(`dialog`)
    .getByRole(`button`, { name: `Create contest` })
    .click()

  await expect.element(page.getByText(`Opened Science Club`)).toBeVisible()
})

test(`a contest without a name isn't created`, async () => {
  await renderDashboard({
    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      deletedCount: 0,
    },
  })
  await page.getByRole(`button`, { name: `Create contest` }).click()

  await page
    .getByRole(`dialog`)
    .getByRole(`button`, { name: `Create contest` })
    .click()

  await expect.element(page.getByText(`Enter the contest’s name`)).toBeVisible()
  await expectNoAxeViolations()
})

test(`the educator dashboard links deleted contests once there are some`, async () => {
  await renderDashboard({
    current: { year: 2027, isLocked: false, contests: [], deletedCount: 1 },
  })

  await expect
    .element(page.getByRole(`link`, { name: `Deleted contests (1)` }))
    .toHaveAttribute(`href`, `/contests/trash`)
})

test(`the educator dashboard leaves out deleted contests without any`, async () => {
  await renderDashboard({
    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      deletedCount: 0,
    },
  })

  await expect
    .element(page.getByRole(`link`, { name: `Period 2 Biology`, exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`link`, { name: /^Deleted contests/u }))
    .not.toBeInTheDocument()
})

test(`once submissions close, the educator dashboard says why no contest can be created`, async () => {
  await renderDashboard({
    current: {
      year: 2027,
      isLocked: true,
      contests: CONTESTS,
      deletedCount: 0,
    },
  })

  await expect
    .element(page.getByText(`The first 2027 result is in`, { exact: false }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Create contest` }))
    .not.toBeInTheDocument()
})

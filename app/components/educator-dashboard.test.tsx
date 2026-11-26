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
  await renderDashboard({
    organization: null,

    current: null,
    upcomingYear: 2027,
  })

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
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: [],
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
    },
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
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
    },
  })

  await page.getByRole(`link`, { name: `Period 5 Biology` }).click()

  await expect.element(page.getByText(`Opened period-5`)).toBeVisible()
})

test(`the contest list passes accessibility checks`, async () => {
  await renderDashboard({
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
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
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
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
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
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
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: [],
      sharedContests: [],
      deletedCount: 1,
      hasPastYears: false,
    },
  })

  await expect
    .element(page.getByRole(`link`, { name: `Deleted contests (1)` }))
    .toHaveAttribute(`href`, `/contests/trash`)
})

test(`the educator dashboard leaves out deleted contests without any`, async () => {
  await renderDashboard({
    organization: null,

    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
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
    organization: null,

    current: {
      year: 2027,
      isLocked: true,
      contests: CONTESTS,
      sharedContests: [],
      deletedCount: 0,
      hasPastYears: false,
    },
  })

  await expect
    .element(page.getByText(`The first 2027 result is in`, { exact: false }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Create contest` }))
    .not.toBeInTheDocument()
})

test(`an organization without a name asks for one`, async () => {
  await renderDashboard({
    organization: { domain: `walkerville.edu`, name: null },

    current: null,
    upcomingYear: 2027,
  })

  await expect
    .element(page.getByRole(`heading`, { name: `Name your organization` }))
    .toBeVisible()
  await expect.element(page.getByText(`walkerville.edu`)).toBeVisible()
  await expectNoAxeViolations()
})

test(`a named organization shows above the title`, async () => {
  await renderDashboard({
    organization: { domain: `walkerville.edu`, name: `Walkerville Elementary` },

    current: null,
    upcomingYear: 2027,
  })

  await expect.element(page.getByText(`Walkerville Elementary`)).toBeVisible()
  await expect
    .element(page.getByRole(`heading`, { name: `Name your organization` }))
    .not.toBeInTheDocument()
})

test(`contests shared with the educator open from the dashboard`, async () => {
  await renderDashboard({
    organization: { domain: `example.com`, name: `Springfield High` },

    current: {
      year: 2027,
      isLocked: false,
      contests: CONTESTS,
      sharedContests: [
        {
          id: `period-1`,
          name: `Period 1 Chemistry`,
          year: 2027,
          educatorName: `Mr. Ruhle`,
        },
      ],
      deletedCount: 0,
      hasPastYears: false,
    },
  })
  await expect.element(page.getByText(`Mr. Ruhle`)).toBeVisible()
  await expectNoAxeViolations()

  await page.getByRole(`link`, { name: `Period 1 Chemistry` }).click()

  await expect.element(page.getByText(`Opened period-1`)).toBeVisible()
})

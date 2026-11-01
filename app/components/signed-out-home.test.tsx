import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { BRACKET_2025 } from '../../prisma/brackets.ts'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { buildBracketView } from '../bracket-view.ts'
import { SignedOutHome } from './signed-out-home.tsx'

const renderHome = async (
  upcomingYear = 2027,
  current?: { year: number; expectedLockDate: string | null },
) => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => (
        <SignedOutHome
          upcomingYear={upcomingYear}
          current={
            current
              ? {
                  view: buildBracketView(current.year, BRACKET_2025, []),
                  expectedLockDate: current.expectedLockDate,
                }
              : null
          }
        />
      ),
    },
  ])
  await render(<Stub />)
}

test(`the home page invites educators to play March Mammal Madness`, async () => {
  await renderHome()

  await expect
    .element(
      page.getByRole(`heading`, {
        name: `Play March Mammal Madness with your class`,
      }),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`the home page links to ASU's March Mammal Madness page`, async () => {
  await renderHome()

  await expect
    .element(page.getByRole(`link`, { name: `March Mammal Madness` }))
    .toHaveAttribute(`href`, `https://libguides.asu.edu/marchmammalmadness`)
})

test(`the home page says when the upcoming year's bracket is expected`, async () => {
  await renderHome(2031)

  await expect
    .element(
      page.getByText(`the 2031 bracket once ASU publishes it`, {
        exact: false,
      }),
    )
    .toBeVisible()
})

test.each([
  { name: `Sign up`, href: `/sign-up` },
  { name: `Sign in`, href: `/sign-in` },
])(`the home page links to $name`, async ({ name, href }) => {
  await renderHome()

  await expect
    .element(page.getByRole(`link`, { name, exact: true }))
    .toHaveAttribute(`href`, href)
})

test(`the home page tells players they don't need to sign up`, async () => {
  await renderHome()

  await expect
    .element(page.getByText(`Players don't need an account`, { exact: false }))
    .toBeVisible()
})

test(`the home page shows the current bracket below its intro`, async () => {
  await renderHome(2027, { year: 2026, expectedLockDate: null })

  await expect
    .element(page.getByRole(`heading`, { name: `2026 bracket` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`the current bracket's expected lock date shows as a heads-up`, async () => {
  await renderHome(2027, { year: 2027, expectedLockDate: `March 19, 2027` })

  await expect
    .element(
      page.getByText(`Expected to lock March 19, 2027`, { exact: false }),
    )
    .toBeVisible()
})

test(`the home page stops promising the upcoming year's bracket once it's current`, async () => {
  await renderHome(2027, { year: 2027, expectedLockDate: null })

  await expect
    .element(page.getByText(`once ASU publishes it`, { exact: false }))
    .not.toBeInTheDocument()
})

import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { SignedOutHome } from './signed-out-home.tsx'

const renderHome = async (upcomingYear = 2027) => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => <SignedOutHome upcomingYear={upcomingYear} />,
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

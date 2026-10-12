import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { SiteHeader } from './site-header.tsx'

test(`the wordmark links to the home page`, async () => {
  const Stub = createRoutesStub([{ path: `/`, Component: SiteHeader }])

  await render(<Stub />)

  await expect
    .element(page.getByRole(`link`, { name: `MMMM` }))
    .toHaveAttribute(`href`, `/`)
  await expectNoAxeViolations()
})

test(`a signed-in educator's name links to their settings`, async () => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => <SiteHeader educator={{ name: `Ms. Frizzle` }} />,
    },
  ])

  await render(<Stub />)

  await expect
    .element(page.getByRole(`link`, { name: `Ms. Frizzle` }))
    .toHaveAttribute(`href`, `/settings`)
  await expectNoAxeViolations()
})

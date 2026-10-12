import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { PageTitle } from './page-title.tsx'

test(`the page title is the heading and the tab title`, async () => {
  await render(<PageTitle>Privacy policy</PageTitle>)

  await expect
    .element(page.getByRole(`heading`, { name: `Privacy policy` }))
    .toBeVisible()
  expect(document.title).toBe(`Privacy policy`)
})

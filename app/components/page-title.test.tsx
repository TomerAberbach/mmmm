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

test(`a title's column is at least as wide as its longest word`, async () => {
  await render(
    <div style={{ width: `min-content` }}>
      <PageTitle>Authenticator app</PageTitle>
    </div>,
  )

  const heading = page.getByRole(`heading`).element()

  expect(heading.getBoundingClientRect().width).toBeGreaterThan(200)
})

test(`a title splits a word that can't fit a line`, async () => {
  await render(
    <div style={{ width: 100 }}>
      <PageTitle>Authenticator app</PageTitle>
    </div>,
  )

  const heading = page.getByRole(`heading`).element()

  expect(heading.scrollWidth).toBeLessThanOrEqual(100)
})

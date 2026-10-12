import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { PasswordField } from './text-field.tsx'

test(`the password toggle keeps its width as it switches labels`, async () => {
  await render(<PasswordField name='password' label='Password' />)
  const toggle = page.getByRole(`button`, { name: `Show password` })
  // The button's font loads after the first render and changes its width
  await document.fonts.ready
  const widthShowing = toggle.element().getBoundingClientRect().width

  await toggle.click()

  const hide = page.getByRole(`button`, { name: `Hide password` })
  await expect.element(hide).toBeVisible()
  expect(hide.element().getBoundingClientRect().width).toBe(widthShowing)
  await expectNoAxeViolations()
})

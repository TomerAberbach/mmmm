import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'

const readThemeColor = (name: string): string => {
  const probe = document.createElement(`div`)
  probe.style.color = `var(--color-${name})`
  document.body.append(probe)
  const { color } = getComputedStyle(probe)
  probe.remove()
  return color
}

test(`a focused form control has the theme's border and focus outline`, async () => {
  const screen = await render(<input type='email' aria-label='Email' />)
  const input = screen.getByRole(`textbox`).element() as HTMLInputElement

  input.focus()

  const style = getComputedStyle(input)
  expect(style.borderTopColor).toBe(readThemeColor(`ink`))
  expect(style.outlineStyle).toBe(`solid`)
  expect(style.outlineColor).toBe(readThemeColor(`accent-strong`))
  expect(style.boxShadow).toBe(`none`)
})

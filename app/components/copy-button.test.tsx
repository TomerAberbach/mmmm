import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { CopyButton } from './copy-button.tsx'

const LINK = `https://mmmm.onl/play/secret`

// Browser tests run in Chromium, so Node's support doesn't apply
// eslint-disable-next-line node/no-unsupported-features/node-builtins
const { clipboard } = navigator

test(`copying puts the text on the clipboard and says so`, async () => {
  const writeText = vi
    .spyOn(clipboard, `writeText`)
    .mockResolvedValue(undefined)
  await render(<CopyButton text={LINK} />)

  await page.getByRole(`button`, { name: `Copy link` }).click()

  expect(writeText).toHaveBeenCalledWith(LINK)
  await expect
    .element(page.getByRole(`button`, { name: `Copied` }))
    .toBeVisible()
  await expect.element(page.getByText(`Copied the link`)).toBeInTheDocument()
})

test(`a refused copy says it failed`, async () => {
  vi.spyOn(clipboard, `writeText`).mockRejectedValue(
    new DOMException(`Denied`, `NotAllowedError`),
  )
  await render(<CopyButton text={LINK} />)

  await page.getByRole(`button`, { name: `Copy link` }).click()

  await expect
    .element(page.getByRole(`button`, { name: `Couldn’t copy` }))
    .toBeVisible()
  await expect
    .element(page.getByText(`Couldn’t copy the link`, { exact: true }))
    .toBeInTheDocument()
})

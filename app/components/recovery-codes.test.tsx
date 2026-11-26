import { createRoutesStub } from 'react-router'
import { expect, test, vi } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { RecoveryCodes } from './recovery-codes.tsx'

const CODES = [`abcde-fghij`, `klmno-pqrst`]

const renderCodes = async () => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => <RecoveryCodes codes={CODES} continueTo='/admin' />,
    },
  ])
  await render(<Stub />)
}

test(`continuing waits until the educator says they saved the codes`, async () => {
  await renderCodes()

  await expect
    .element(page.getByRole(`link`, { name: `Continue` }))
    .toHaveAttribute(`aria-disabled`, `true`)
  await expectNoAxeViolations()
})

test(`saying the codes are saved lets the educator continue`, async () => {
  await renderCodes()

  await page.getByText(`I've saved these codes`).click()

  await expect
    .element(page.getByRole(`link`, { name: `Continue` }))
    .not.toHaveAttribute(`aria-disabled`)
})

test(`the download holds every code, one per line`, async () => {
  await renderCodes()

  const download = page.getByRole(`link`, { name: `Download` })

  await expect
    .element(download)
    .toHaveAttribute(
      `href`,
      `data:text/plain;charset=utf-8,${encodeURIComponent(CODES.join(`\n`))}`,
    )
})

test(`codes the browser can't copy say so`, async () => {
  // Runs only in the browser, so Node's support doesn't apply
  // eslint-disable-next-line node/no-unsupported-features/node-builtins
  vi.spyOn(navigator.clipboard, `writeText`).mockRejectedValue(
    new Error(`Not allowed`),
  )
  await renderCodes()

  await page.getByRole(`button`, { name: `Copy codes` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(
      `Couldn’t copy. Download or write down the codes instead`,
    )
})

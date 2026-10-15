import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { SecondFactorChoice, SetupLinkRequest } from './second-factor-setup.tsx'

const renderRequest = async (state: {
  linkInvalid: boolean
  isSent: boolean
}) => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: () => (
        <SetupLinkRequest email='frizzle@example.com' {...state} />
      ),
    },
  ])
  await render(<Stub />)
}

test(`before the link is sent, the page offers to email it`, async () => {
  await renderRequest({ linkInvalid: false, isSent: false })

  await expect
    .element(page.getByRole(`button`, { name: `Email me a setup link` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`once the link is sent, the page says so and offers to send it again`, async () => {
  await renderRequest({ linkInvalid: false, isSent: true })

  await expect
    .element(page.getByRole(`status`))
    .toHaveTextContent(`We emailed you a setup link. It expires in 1 hour.`)
  await expect
    .element(page.getByRole(`button`, { name: `Send again` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a used or expired link asks for a new one`, async () => {
  await renderRequest({ linkInvalid: true, isSent: false })

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(
      `That setup link has expired or was already used. Email yourself a new one.`,
    )
  await expectNoAxeViolations()
})

test(`the choice recommends a passkey first`, async () => {
  const Stub = createRoutesStub([{ path: `/`, Component: SecondFactorChoice }])
  await render(<Stub />)

  const headings = page.getByRole(`heading`, { level: 2 })

  await expect.element(headings.first()).toHaveTextContent(`Passkey`)
  await expect
    .element(page.getByRole(`link`, { name: `Use an authenticator app` }))
    .toHaveAttribute(`href`, `/admin/setup/authenticator-app`)
  await expectNoAxeViolations()
})

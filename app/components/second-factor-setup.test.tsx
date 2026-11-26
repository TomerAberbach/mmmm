import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { SecondFactorChoice, SetupLinkRequest } from './second-factor-setup.tsx'

const renderRequest = async (state: {
  linkInvalid: boolean
  sending?: `sent` | `email-limit`
}) => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <SetupLinkRequest email='frizzle@example.com' {...state} />
      ),
    },
  ])
}

test(`before the link is sent, the page offers to email it`, async () => {
  await renderRequest({ linkInvalid: false })

  await expect
    .element(page.getByRole(`button`, { name: `Email me a setup link` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`once the link is sent, the page says so and offers to send it again`, async () => {
  await renderRequest({ linkInvalid: false, sending: `sent` })

  await expect
    .element(page.getByRole(`status`))
    .toHaveTextContent(`We emailed you a setup link. It expires in 1 hour.`)
  await expect
    .element(page.getByRole(`button`, { name: `Send again` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a link that wasn't sent says so`, async () => {
  await renderRequest({ linkInvalid: false, sending: `email-limit` })

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`This address got too many emails. Try again in an hour`)
})

test(`a used or expired link asks for a new one`, async () => {
  await renderRequest({ linkInvalid: true })

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(
      `That setup link has expired or was already used. Email yourself a new one.`,
    )
  await expectNoAxeViolations()
})

test(`the choice recommends a passkey first`, async () => {
  await renderRoutes([{ path: `/`, Component: SecondFactorChoice }])

  const headings = page.getByRole(`heading`, { level: 2 })

  await expect.element(headings.first()).toHaveTextContent(`Passkey`)
  await expect
    .element(page.getByRole(`link`, { name: `Use an authenticator app` }))
    .toHaveAttribute(`href`, `/admin/setup/authenticator-app`)
  await expectNoAxeViolations()
})

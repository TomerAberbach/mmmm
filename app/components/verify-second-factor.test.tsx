import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { VerifySecondFactor } from './verify-second-factor.tsx'

const renderVerify = (props: Parameters<typeof VerifySecondFactor>[0]) =>
  renderRoutes([
    {
      id: `root`,
      path: `/`,
      loader: () => ({ supportEmail: `help@example.com` }),
      HydrateFallback: () => null,
      Component: () => <VerifySecondFactor {...props} />,
    },
  ])

test(`an admin with a passkey and an app may sign out to use the app`, async () => {
  await renderVerify({ hasPasskey: true, hasAuthenticatorApp: true })

  await expect
    .element(page.getByRole(`button`, { name: `Use your passkey` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Sign out` }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`an admin with only a passkey learns who to email without it`, async () => {
  await renderVerify({ hasPasskey: true, hasAuthenticatorApp: false })

  await expect
    .element(page.getByRole(`link`, { name: `help@example.com` }))
    .toHaveAttribute(`href`, `mailto:help@example.com`)
  await expect
    .element(page.getByRole(`button`, { name: `Sign out` }))
    .not.toBeInTheDocument()
})

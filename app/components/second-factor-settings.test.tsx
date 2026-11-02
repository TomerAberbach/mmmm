import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import type { SecondFactorSettingsData } from '../second-factor-settings.server.ts'
import type { ConfirmResult } from './confirm-dialog.tsx'
import { SecondFactorSettings } from './second-factor-settings.tsx'
import type { AuthenticatorAppResult } from './second-factor-settings.tsx'

const ADMIN: SecondFactorSettingsData = {
  isAdmin: true,
  canChange: true,
  passkeys: [
    { id: `passkey-1`, label: `iCloud Keychain`, added: `October 12, 2026` },
  ],
  recoveryCodesLeft: 7,
}

const renderSettings = async (
  data: SecondFactorSettingsData,
  { recoveryCodes = [`abcde-fghij`] }: { recoveryCodes?: string[] } = {},
) => {
  const Stub = createRoutesStub([
    { path: `/`, Component: () => <SecondFactorSettings {...data} /> },
    {
      path: `/settings/remove-passkey`,
      action: (): ConfirmResult => ({ error: `Admins keep at least one.` }),
    },
    {
      path: `/settings/authenticator-app`,
      action: (): AuthenticatorAppResult => ({
        result: { status: `success` },
        recoveryCodes,
      }),
    },
  ])
  await render(<Stub />)
}

test(`an admin sees each passkey and the recovery codes left`, async () => {
  await renderSettings(ADMIN)

  await expect.element(page.getByText(`iCloud Keychain`)).toBeVisible()
  await expect.element(page.getByText(`Added October 12, 2026`)).toBeVisible()
  await expect
    .element(page.getByText(`On. 7 recovery codes left.`))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a session that hasn't used a second factor can't change them`, async () => {
  await renderSettings({ ...ADMIN, canChange: false })

  await expect
    .element(page.getByRole(`status`))
    .toHaveTextContent(
      `Open the admin area and use your second factor before changing these.`,
    )
  await expect
    .element(page.getByRole(`button`, { name: `Remove` }))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`button`, { name: `Add a passkey` }))
    .not.toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`removing a passkey asks first and shows why it failed`, async () => {
  await renderSettings(ADMIN)

  await page.getByRole(`button`, { name: `Remove` }).click()
  await page.getByRole(`button`, { name: `Remove passkey` }).click()

  await expect
    .element(page.getByRole(`alertdialog`).getByRole(`alert`))
    .toHaveTextContent(`Admins keep at least one.`)
})

test(`new recovery codes show once they're made`, async () => {
  await renderSettings(ADMIN, { recoveryCodes: [`abcde-fghij`, `klmno-pqrst`] })

  await userEvent.fill(page.getByLabelText(`Password`, { exact: true }), `x`)
  await page.getByRole(`button`, { name: `Get new recovery codes` }).click()

  await expect.element(page.getByText(`klmno-pqrst`)).toBeVisible()
  await expectNoAxeViolations()
})

test(`an admin without an authenticator app can set one up`, async () => {
  await renderSettings({ ...ADMIN, recoveryCodesLeft: undefined })

  await expect
    .element(page.getByRole(`link`, { name: `Set up an authenticator app` }))
    .toHaveAttribute(`href`, `/admin/setup/authenticator-app`)
})

test(`a former admin can remove a passkey but not add one`, async () => {
  await renderSettings({
    ...ADMIN,
    isAdmin: false,
    recoveryCodesLeft: undefined,
  })

  await expect
    .element(page.getByRole(`button`, { name: `Remove` }))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Add a passkey` }))
    .not.toBeInTheDocument()
  await expect
    .element(page.getByRole(`link`, { name: `Set up an authenticator app` }))
    .not.toBeInTheDocument()
})

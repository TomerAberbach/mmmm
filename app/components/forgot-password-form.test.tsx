import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { ForgotPasswordForm, ResetLinkSent } from './forgot-password-form.tsx'

const renderAt = async (element: React.ReactElement) => {
  const Stub = createRoutesStub([
    { path: `/forgot-password`, Component: () => element },
  ])
  await render(<Stub initialEntries={[`/forgot-password`]} />)
}

test(`the reset request asks for the email address`, async () => {
  await renderAt(<ForgotPasswordForm />)

  await expect.element(page.getByLabelText(`Email address`)).toBeVisible()
  await expectNoAxeViolations()
})

test(`a used or expired reset link says to request a new one`, async () => {
  await renderAt(<ForgotPasswordForm linkInvalid />)

  await expect
    .element(page.getByRole(`alert`))
    .toMatchTextContent(`expired or was already used`)
  await expectNoAxeViolations()
})

test(`the sent page names the address without saying whether an educator uses it`, async () => {
  await renderAt(<ResetLinkSent email='ada@school.org' />)

  await expect
    .element(page.getByText(`If an account uses`, { exact: false }))
    .toMatchTextContent(`ada@school.org`)
  await expectNoAxeViolations()
})

import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { ResetPasswordForm } from './reset-password-form.tsx'

const renderReset = async (): Promise<{ submissions: number }> => {
  const counts = { submissions: 0 }
  const Stub = createRoutesStub([
    {
      path: `/reset-password`,
      Component: () => <ResetPasswordForm token='a-token' />,
      action: () => {
        counts.submissions++
        return null
      },
    },
  ])
  await render(<Stub initialEntries={[`/reset-password`]} />)
  return counts
}

test(`a short new password is rejected before submitting`, async () => {
  const counts = await renderReset()

  await userEvent.fill(page.getByLabelText(`New password`), `short`)
  await page.getByRole(`button`, { name: `Set password` }).click()

  await expect
    .element(page.getByText(`Enter a password of at least 10 characters`))
    .toBeVisible()
  expect(counts.submissions).toBe(0)
  await expectNoAxeViolations()
})

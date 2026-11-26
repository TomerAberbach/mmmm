import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { ResetPasswordForm } from './reset-password-form.tsx'

const renderReset = async (): Promise<{ submissions: number }> => {
  const counts = { submissions: 0 }
  await renderRoutes(
    [
      {
        path: `/reset-password`,
        Component: () => <ResetPasswordForm token='a-token' />,
        action: () => {
          counts.submissions++
          return null
        },
      },
    ],
    `/reset-password`,
  )
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

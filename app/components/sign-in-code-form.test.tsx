import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { SignInCodeForm } from './sign-in-code-form.tsx'

/** Records each code the action receives */
const renderForm = async (received: unknown[] = []) => {
  await renderRoutes([
    { path: `/`, Component: () => <SignInCodeForm /> },
    {
      path: `/sign-in/code`,
      action: async ({ request }) => {
        received.push((await request.formData()).get(`code`))
        return null
      },
    },
  ])
}

test(`a code that isn't 6 digits asks for the app's code`, async () => {
  await renderForm()

  await userEvent.fill(page.getByLabelText(`Security code`), `12345`)
  await page.getByRole(`button`, { name: `Continue` }).click()

  await expect
    .element(
      page
        .getByText(`Enter the 6-digit code from your authenticator app`)
        .last(),
    )
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`a code with the spaces an app shows is sent`, async () => {
  const received: unknown[] = []
  await renderForm(received)

  await userEvent.fill(page.getByLabelText(`Security code`), `123 456`)
  await page.getByRole(`button`, { name: `Continue` }).click()

  await expect.poll(() => received).toStrictEqual([`123 456`])
})

test(`the field opens the numeric keypad and accepts a code from the phone`, async () => {
  await renderForm()

  const field = page.getByLabelText(`Security code`)

  await expect.element(field).toHaveAttribute(`inputmode`, `numeric`)
  await expect.element(field).toHaveAttribute(`autocomplete`, `one-time-code`)
})

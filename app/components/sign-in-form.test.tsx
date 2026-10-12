import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { signInSchema } from '../auth-forms.ts'
import { SignInForm } from './sign-in-form.tsx'
import type { SignInNotice } from './sign-in-form.tsx'

const renderSignIn = async (notice?: SignInNotice): Promise<void> => {
  const Stub = createRoutesStub([
    {
      path: `/`,
      Component: ({ actionData }: { actionData?: { result: never } }) => (
        <SignInForm lastResult={actionData?.result} notice={notice} />
      ),
      action: async ({ request }) => ({
        result: parseWithZod(await request.formData(), {
          schema: signInSchema,
        }).reply({ formErrors: [`Email address or password is incorrect`] }),
      }),
    },
  ])
  await render(<Stub />)
}

test(`a failed sign-in shows the server's message`, async () => {
  await renderSignIn()

  await userEvent.fill(page.getByLabelText(`Email address`), `ada@school.org`)
  await userEvent.fill(page.getByLabelText(`Password`), `wrong password`)
  await page.getByRole(`button`, { name: `Sign in` }).click()

  await expect
    .element(page.getByRole(`alert`))
    .toHaveTextContent(`Email address or password is incorrect`)
  await expectNoAxeViolations()
})

test(`a failed confirmation link says to sign in for a new one`, async () => {
  await renderSignIn(`link-invalid`)

  await expect
    .element(page.getByRole(`alert`))
    .toMatchTextContent(`Sign in to get a new one`)
})

test(`a confirmed educator is told to sign in`, async () => {
  await renderSignIn(`confirmed`)

  await expect
    .element(page.getByRole(`status`))
    .toHaveTextContent(
      `Your email address is confirmed. Sign in to start running contests.`,
    )
  await expectNoAxeViolations()
})

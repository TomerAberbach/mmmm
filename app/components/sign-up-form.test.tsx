import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { signUpSchema } from '../auth-forms.ts'
import { freeTextSchema } from '../free-text.ts'
import { SignUpForm } from './sign-up-form.tsx'

// Renders the form with an action that answers like the server would
const renderSignUp = async (
  serverErrors: Record<string, string[]> = {},
): Promise<{ submissions: number }> => {
  const counts = { submissions: 0 }
  const Stub = createRoutesStub([
    {
      path: `/sign-up`,
      Component: ({ actionData }: { actionData?: { result: never } }) => (
        <SignUpForm lastResult={actionData?.result} />
      ),
      action: async ({ request }) => {
        counts.submissions++
        const submission = parseWithZod(await request.formData(), {
          schema: signUpSchema(freeTextSchema),
        })
        return { result: submission.reply({ fieldErrors: serverErrors }) }
      },
    },
  ])
  await render(<Stub initialEntries={[`/sign-up`]} />)
  return counts
}

const fillIn = async (fields: {
  name: string
  email: string
  password: string
}) => {
  await userEvent.fill(page.getByLabelText(`Full name`), fields.name)
  await userEvent.fill(page.getByLabelText(`Email address`), fields.email)
  await userEvent.fill(
    page.getByLabelText(`Create a password`),
    fields.password,
  )
}

test(`the sign-up form tells players they don't need to sign up`, async () => {
  await renderSignUp()

  await expect
    .element(page.getByText(`Players don't need an account`, { exact: false }))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`submitting an empty form shows each field's error without sending it`, async () => {
  const counts = await renderSignUp()

  await page.getByRole(`button`, { name: `Sign up` }).click()

  await expect.element(page.getByText(`Enter your full name`)).toBeVisible()
  await expect
    .element(page.getByText(`Enter an email address like name@school.org`))
    .toBeVisible()
  await expect
    .element(page.getByText(`Enter a password of at least 10 characters`))
    .toBeVisible()
  expect(counts.submissions).toBe(0)
  await expectNoAxeViolations()
})

test(`a short password shows the minimum length`, async () => {
  await renderSignUp()

  await fillIn({ name: `Ada`, email: `ada@school.org`, password: `short` })
  await page.getByRole(`button`, { name: `Sign up` }).click()

  await expect
    .element(page.getByLabelText(`Create a password`))
    .toHaveAccessibleDescription(/Enter a password of at least 10 characters/u)
})

test(`an error from the server shows on its field`, async () => {
  await renderSignUp({
    name: [`Remove the offensive words from your full name`],
  })

  await fillIn({
    name: `Ada`,
    email: `ada@school.org`,
    password: `correct horse battery`,
  })
  await page.getByRole(`button`, { name: `Sign up` }).click()

  await expect
    .element(page.getByLabelText(`Full name`))
    .toHaveAccessibleDescription(
      `Remove the offensive words from your full name`,
    )
})

test(`Show reveals the password`, async () => {
  await renderSignUp()
  const password = page.getByLabelText(`Create a password`)

  await page.getByRole(`button`, { name: `Show password` }).click()

  await expect.element(password).toHaveAttribute(`type`, `text`)
  await expect
    .element(page.getByRole(`button`, { name: `Hide password` }))
    .toBeVisible()
})

test(`leaving a field before submitting shows no error yet`, async () => {
  await renderSignUp()

  await userEvent.fill(page.getByLabelText(`Full name`), ``)
  await userEvent.click(page.getByLabelText(`Email address`))

  await expect
    .element(page.getByText(`Enter your full name`))
    .not.toBeInTheDocument()
})

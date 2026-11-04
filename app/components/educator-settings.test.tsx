import { parseWithZod } from '@conform-to/zod/v4'
import { createRoutesStub } from 'react-router'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { changePasswordSchema, nameSchema } from '../auth-forms.ts'
import { freeTextSchema } from '../free-text.ts'
import type { ConfirmResult } from './confirm-dialog.tsx'
import { EducatorSettings } from './educator-settings.tsx'

// Renders the page with actions that answer like the server would
const renderSettings = async ({
  passwordErrors = {},
}: { passwordErrors?: Record<string, string[]> } = {}) => {
  const Stub = createRoutesStub([
    { path: `/`, Component: () => <EducatorSettings name='Ms. Frizzle' /> },
    {
      path: `/settings/name`,
      action: async ({ request }) => ({
        result: parseWithZod(await request.formData(), {
          schema: nameSchema(freeTextSchema),
        }).reply(),
        saved: true,
      }),
    },
    {
      path: `/settings/password`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: changePasswordSchema,
        })
        return Object.keys(passwordErrors).length > 0
          ? { result: submission.reply({ fieldErrors: passwordErrors }) }
          : { result: submission.reply({ resetForm: true }), saved: true }
      },
    },
    {
      path: `/settings/sign-out-others`,
      action: (): ConfirmResult => ({ ok: true }),
    },
  ])
  await render(<Stub />)
}

const fillPasswords = async () => {
  await userEvent.fill(
    page.getByLabelText(`Current password`),
    `correct horse battery`,
  )
  await userEvent.fill(
    page.getByLabelText(`New password`),
    `a brand new password`,
  )
  await page.getByRole(`button`, { name: `Change password` }).click()
}

test(`the name field starts with the educator's name`, async () => {
  await renderSettings()

  await expect
    .element(page.getByLabelText(`Full name`))
    .toHaveValue(`Ms. Frizzle`)
  await expectNoAxeViolations()
})

test(`saving the name confirms it below the button`, async () => {
  await renderSettings()

  await userEvent.fill(page.getByLabelText(`Full name`), `Valerie Frizzle`)
  await page.getByRole(`button`, { name: `Save name` }).click()

  await expect
    .element(page.getByRole(`status`))
    .toHaveTextContent(`Your name is saved.`)
})

test(`changing the password confirms it and clears the fields`, async () => {
  await renderSettings()

  await fillPasswords()

  await expect
    .element(page.getByRole(`status`))
    .toMatchTextContent(`Your password is changed`)
  await expect.element(page.getByLabelText(`New password`)).toHaveValue(``)
})

test(`a wrong current password shows under that field`, async () => {
  await renderSettings({
    passwordErrors: { currentPassword: [`Your current password is incorrect`] },
  })

  await fillPasswords()

  await expect
    .element(page.getByText(`Your current password is incorrect`))
    .toBeVisible()
  await expectNoAxeViolations()
})

test(`signing out other sessions asks first, then confirms`, async () => {
  await renderSettings()

  await page.getByRole(`button`, { name: `Sign out other sessions` }).click()
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Sign out other sessions` })
    .click()

  await expect
    .element(page.getByRole(`status`))
    .toHaveTextContent(`Every other session is signed out.`)
})

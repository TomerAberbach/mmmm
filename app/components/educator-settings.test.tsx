import { parseWithZod } from '@conform-to/zod/v4'
import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { changePasswordSchema, nameSchema } from '../auth-forms.ts'
import { freeTextSchema } from '../free-text.ts'
import { EducatorSettings } from './educator-settings.tsx'
import type { ConfirmResult } from '~/form-replies.server.ts'

/** Renders the page with actions that answer like the server would */
const renderSettings = async ({
  passwordErrors = {},
  canDelete = true,
}: {
  passwordErrors?: Record<string, string[]>
  canDelete?: boolean
} = {}) => {
  await renderRoutes([
    {
      path: `/`,
      // A save reloads the page's data
      loader: () => ({}),
      HydrateFallback: () => null,
      Component: () => (
        <EducatorSettings
          account={{
            email: `ada@example.com`,
            contestCount: 1,
            hasShares: false,
            isConfirmed: true,
          }}
          canDelete={canDelete}
          organization={null}
          name='Ms. Frizzle'
        />
      ),
    },
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
    .toHaveTextContent(`Saved your name`)
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
    passwordErrors: { currentPassword: [`Your password is incorrect`] },
  })

  await fillPasswords()

  await expect
    .element(page.getByText(`Your password is incorrect`))
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
    .toHaveTextContent(`Every other session is signed out`)
})

test(`the password section links to resetting a forgotten password`, async () => {
  await renderSettings()

  await expect
    .element(page.getByRole(`link`, { name: `Forgot password?` }))
    .toHaveAttribute(`href`, `/forgot-password`)
})

test(`a session that can't delete the account learns how before any dialog`, async () => {
  await renderSettings({ canDelete: false })

  await expect
    .element(page.getByRole(`status`))
    .toMatchTextContent(`sign in with your passkey or authenticator app`)
  await expect
    .element(page.getByRole(`button`, { name: `Delete account` }))
    .not.toBeInTheDocument()
  await expectNoAxeViolations()
})

test(`a saved name's notice goes once another action is made`, async () => {
  await renderSettings()
  await page.getByRole(`button`, { name: `Save name` }).click()
  await expect.element(page.getByText(`Saved your name`)).toBeVisible()

  await fillPasswords()

  await expect
    .element(page.getByText(/^Your password is changed/u))
    .toBeVisible()
  await expect
    .element(page.getByText(`Saved your name`))
    .not.toBeInTheDocument()
})

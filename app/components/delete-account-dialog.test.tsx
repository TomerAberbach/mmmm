import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { accountDeletionSchema } from '../account-deletion-forms.ts'
import { Button } from './button.tsx'
import { DeleteAccountDialog } from './delete-account-dialog.tsx'

/** The action deletes the account only with its address */
const openDialog = async ({
  contestCount = 0,
  hasShares = false,
}: { contestCount?: number; hasShares?: boolean } = {}) => {
  await renderRoutes([
    {
      path: `/`,
      Component: () => (
        <DeleteAccountDialog
          trigger={<Button>Delete account</Button>}
          title='Delete your account?'
          account={{
            email: `ada@example.com`,
            contestCount,
            hasShares,
            isConfirmed: true,
          }}
          action='/delete'
        />
      ),
    },
    {
      path: `/delete`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: accountDeletionSchema,
        })
        return submission.status === `success` &&
          submission.value.email === `ada@example.com`
          ? redirect(`/deleted`)
          : { result: submission.reply({ fieldErrors: { email: [`Wrong`] } }) }
      },
    },
    { path: `/deleted`, Component: () => <p>Deleted</p> },
  ])
  await page.getByRole(`button`, { name: `Delete account` }).click()
}

const confirm = async (email: string) => {
  await page.getByLabelText(`Type ada@example.com to confirm`).fill(email)
  await page
    .getByRole(`alertdialog`)
    .getByRole(`button`, { name: `Delete account` })
    .click()
}

test(`an account is deleted once its address is typed`, async () => {
  await openDialog({ contestCount: 3 })
  await expect
    .element(page.getByText(/3 contests stay without an educator/u))
    .toBeVisible()
  await expectNoAxeViolations()

  await confirm(`ada@example.com`)

  await expect.element(page.getByText(`Deleted`)).toBeVisible()
})

test(`another address deletes nothing and says so`, async () => {
  await openDialog()

  await confirm(`grace@example.com`)

  await expect.element(page.getByText(`Wrong`)).toBeVisible()
})

test(`an account without contests mentions none`, async () => {
  await openDialog()

  await expect.element(page.getByRole(`alertdialog`)).toBeVisible()
  await expect
    .element(page.getByText(/without an educator/u))
    .not.toBeInTheDocument()
})

test.each([
  { hasShares: true, isShown: true },
  { hasShares: false, isShown: false },
])(
  `the dialog mentions shared contests only when there are some ($hasShares)`,
  async ({ hasShares, isShown }) => {
    await openDialog({ hasShares })

    await expect.element(page.getByRole(`alertdialog`)).toBeVisible()
    expect(page.getByText(/stop being shared/u).elements().length > 0).toBe(
      isShown,
    )
  },
)

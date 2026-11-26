import { parseWithZod } from '@conform-to/zod/v4'
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { expectNoAxeViolations } from '../../test/axe.ts'
import { renderRoutes } from '../../test/render-routes.tsx'
import { addressSchema } from '../support-forms.ts'
import { EducatorSupport } from './educator-support.tsx'
import type { FoundEducator } from '~/support.server.ts'

const ADA: FoundEducator = {
  id: `ada`,
  name: `Ada Lovelace`,
  email: `ada@example.com`,
  isConfirmed: true,
  organizationName: null,
  contestCount: 2,
  createdAt: new Date(`2027-03-02T16:00:00Z`),
}

const renderSupport = (educator: FoundEducator) =>
  renderRoutes([
    { path: `/`, Component: () => <EducatorSupport educator={educator} /> },
    {
      path: `/admin/educators/ada/address`,
      action: async ({ request }) => {
        const submission = parseWithZod(await request.formData(), {
          schema: addressSchema,
        })
        return submission.status === `success` &&
          submission.value.email === `ada@new.example`
          ? { result: submission.reply({ resetForm: true }), saved: true }
          : {
              result: submission.reply({ fieldErrors: { email: [`Taken`] } }),
            }
      },
    },
  ])

const changeAddress = async (email: string) => {
  await page.getByRole(`button`, { name: `Change address` }).click()
  await expectNoAxeViolations()
  await page.getByLabelText(`New email address`).fill(email)
  await page.getByRole(`button`, { name: `Send the link` }).click()
}

test(`changing an address says what it does, then that the link was sent`, async () => {
  await renderSupport(ADA)

  await changeAddress(`ada@new.example`)

  await expect
    .element(page.getByText(/We emailed the new address/u))
    .toBeVisible()
  await expect.element(page.getByRole(`dialog`)).not.toBeInTheDocument()
})

test(`a refused address shows why`, async () => {
  await renderSupport(ADA)

  await changeAddress(`taken@example.com`)

  await expect.element(page.getByText(`Taken`)).toBeVisible()
})

test(`an unconfirmed educator's address can't change`, async () => {
  await renderSupport({ ...ADA, isConfirmed: false })

  await expect
    .element(page.getByText(`ada@example.com, unconfirmed`))
    .toBeVisible()
  await expect
    .element(page.getByRole(`button`, { name: `Change address` }))
    .not.toBeInTheDocument()
})

import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.educators.$educatorId.address.ts'
import { requestAddressChange } from '~/address-changes.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { addressSchema } from '~/support-forms.ts'

export const loader = (): Response => redirect(href(`/admin/educators`))

export const action = ({
  request,
  params,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    addressSchema,
    async ({ email }) => {
      switch (await requestAddressChange(params.educatorId, email)) {
        case null:
          return null
        case `NO_EDUCATOR`:
          return { formErrors: [`This account is gone. Reload the page`] }
        case `TAKEN`:
          return {
            fieldErrors: {
              email: [`An account already has this email address`],
            },
          }
        case `EMAIL_LIMIT`:
          return {
            formErrors: [
              `This address got too many emails. Try again in an hour`,
            ],
          }
      }
    },
    { resetForm: true },
  )

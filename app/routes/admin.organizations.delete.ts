import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.organizations.delete.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { organizationDeletionSchema } from '~/support-forms.ts'
import { deleteOrganization } from '~/support.server.ts'

export const loader = (): Response => redirect(href(`/admin/organizations`))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    organizationDeletionSchema,
    async ({ domain, confirmation }) => {
      if (confirmation !== domain) {
        return { fieldErrors: { confirmation: [`This isn’t the domain`] } }
      }
      switch (
        await deleteOrganization(domain, readRequiredEducator(context).id)
      ) {
        case `DELETED`:
          return null
        case `GONE`:
          return { formErrors: [`That organization is gone. Reload the page`] }
        case `OWN`:
          return {
            formErrors: [
              `Your own account is in this organization, so it can’t be deleted`,
            ],
          }
      }
    },
  )

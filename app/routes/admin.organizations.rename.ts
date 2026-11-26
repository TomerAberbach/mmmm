import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.organizations.rename.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { organizationRenameSchema } from '~/organization-forms.ts'
import { renameOrganization } from '~/organizations.server.ts'

export const loader = (): Response => redirect(href(`/admin/organizations`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, organizationRenameSchema, async ({ domain, name }) =>
    (await renameOrganization(domain, name))
      ? null
      : { formErrors: [`This organization is gone. Reload the page`] },
  )

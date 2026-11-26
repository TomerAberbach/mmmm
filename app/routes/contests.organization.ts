import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.organization.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { organizationNameSchema } from '~/organization-forms.ts'
import { nameOrganization } from '~/organizations.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/contests`))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    organizationNameSchema(serverFreeTextSchema),
    async ({ name }) =>
      (await nameOrganization(readRequiredEducator(context).id, name))
        ? null
        : {
            formErrors: [
              `Your organization already has a name. Reload the page`,
            ],
          },
  )

import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.name.ts'
import { nameSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = ({
  request,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, nameSchema(serverFreeTextSchema), async ({ name }) => {
    await auth.api.updateUser({ body: { name }, headers: request.headers })
    return null
  })

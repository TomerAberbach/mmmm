import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.educators.$educatorId.delete.ts'
import { answerAccountDeletion } from '~/account-deletion-replies.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/educators`))

export const action = ({
  request,
  params,
}: Route.ActionArgs): Promise<Response | FormRejection> =>
  answerAccountDeletion(request, params.educatorId, {
    onDeleted: () => redirect(href(`/admin/educators`)),
  })

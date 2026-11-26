import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.educators.$educatorId.delete.ts'
import {
  answerAccountDeletion,
  leaveDeletedAccount,
} from '~/account-deletion-replies.server.ts'
import type { FormRejection } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/admin/educators`))

export const action = ({
  request,
  params,
  context,
}: Route.ActionArgs): Promise<Response | FormRejection> =>
  answerAccountDeletion(request, params.educatorId, {
    onDeleted: () =>
      readRequiredEducator(context).id === params.educatorId
        ? leaveDeletedAccount(request)
        : redirect(`${href(`/admin/educators`)}?deleted`),
  })

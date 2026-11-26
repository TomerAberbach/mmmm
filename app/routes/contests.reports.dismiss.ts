import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.reports.dismiss.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { answerDismissal } from '~/report-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/contests/reports`))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> =>
  answerDismissal(request, {
    kind: `educator`,
    educatorId: readRequiredEducator(context).id,
  })

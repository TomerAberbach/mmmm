import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.reports.dismiss.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { answerDismissal } from '~/report-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/reports`))

export const action = ({ request }: Route.ActionArgs): Promise<ConfirmResult> =>
  answerDismissal(request, { kind: `admin` })

import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.year.report.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import {
  findReportableContestId,
  readEducatorScopes,
} from '~/leaderboard-scopes.server.ts'
import { readRequiredYear } from '~/past-years.server.ts'
import { answerReport } from '~/report-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/years/:year`, params))

/** Reports a row of the organization or global leaderboard */
export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> =>
  answerReport(request, async playerId => {
    const { id: educatorId } = readRequiredEducator(context)
    return findReportableContestId(
      await readEducatorScopes(educatorId, await readRequiredYear(params.year)),
      playerId,
      { kind: `educator`, educatorId },
    )
  })

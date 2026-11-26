import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.report.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import {
  findRankedContestId,
  readEducatorScopes,
} from '~/leaderboard-scopes.server.ts'
import { answerReport } from '~/report-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = (): Response => redirect(href(`/contests`))

/** Reports a row of the organization or global leaderboard */
export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> =>
  answerReport(request, async playerId =>
    findRankedContestId(
      await readEducatorScopes(readRequiredEducator(context).id),
      playerId,
    ),
  )

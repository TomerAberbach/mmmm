import { href, redirect } from 'react-router'
import type { Route } from './+types/player.report.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import {
  findRankedContestId,
  readPlayerScopes,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest } from '~/play-context.server.ts'
import { answerReport } from '~/report-replies.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/player/:contestId/leaderboard`, params))

/** Reports a row of any of the player's leaderboards */
export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> =>
  answerReport(request, async playerId =>
    findRankedContestId(
      await readPlayerScopes(readPlayContest(context)),
      playerId,
    ),
  )

import { href, redirect } from 'react-router'
import type { Route } from './+types/player.report.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import {
  findReportableContestId,
  readPlayerScopes,
} from '~/leaderboard-scopes.server.ts'
import { readPlayContest, readPlayerViewer } from '~/play-context.server.ts'
import { answerReport } from '~/report-replies.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(
    href(`/player/:contestId/leaderboards/:kind`, {
      ...params,
      kind: `contest`,
    }),
  )

/** Reports a row of any of the player's leaderboards */
export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmReply> =>
  answerReport(request, async playerId =>
    findReportableContestId(
      await readPlayerScopes(readPlayContest(context)),
      playerId,
      readPlayerViewer(context),
    ),
  )

import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.report.ts'
import { readViewableContest } from '~/contest-context.server.ts'
import { hasReportablePlayer } from '~/contest-players.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { answerReport } from '~/report-replies.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const { contest } = readViewableContest(context)
  return answerReport(request, async playerId =>
    playerId === null || (await hasReportablePlayer(contest, playerId))
      ? contest.id
      : null,
  )
}

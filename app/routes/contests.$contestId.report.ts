import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.report.ts'
import { readViewableContest } from '~/contest-context.server.ts'
import { hasPlayer } from '~/contest-players.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { answerReport } from '~/report-replies.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const { id } = readViewableContest(context).contest
  return answerReport(request, async playerId =>
    playerId === null || (await hasPlayer(id, playerId)) ? id : null,
  )
}

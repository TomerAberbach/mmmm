import { href, redirect } from 'react-router'
import type { Route } from './+types/play.report.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { readPlayContest } from '~/play-context.server.ts'
import { answerReport } from '~/report-replies.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/play/:linkSecret`, params))

/** Reports the contest's name, which anyone with its contest link sees */
export const action = ({
  request,
  context,
}: Route.ActionArgs): Promise<ConfirmReply> => {
  const { id } = readPlayContest(context)
  return answerReport(request, playerId => (playerId === null ? id : null))
}

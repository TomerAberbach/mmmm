import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.delete.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { refuseStale } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { deleteContest } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  context,
  params,
}: Route.ActionArgs): Promise<Response | ConfirmReply> =>
  (await deleteContest(readRequiredEducator(context).id, params.contestId))
    ? redirect(href(`/contests`))
    : refuseStale(`This contest wasn’t deleted. Reload the page`)

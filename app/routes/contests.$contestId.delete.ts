import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.delete.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { readRequiredEducator } from '~/session.server.ts'
import { deleteContest } from '~/trash.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  context,
  params,
}: Route.ActionArgs): Promise<Response | ConfirmResult> =>
  (await deleteContest(readRequiredEducator(context).id, params.contestId))
    ? redirect(href(`/contests`))
    : { error: `This contest is already deleted. Reload the page` }

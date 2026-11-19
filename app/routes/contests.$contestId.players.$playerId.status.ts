import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.$playerId.status.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { setSubmissionStatus } from '~/contest-players.server.ts'
import { submissionStatusSchema } from '~/player-forms.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, { contestId: params.contestId }))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const parsed = submissionStatusSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!parsed.success) {
    return { error: `Choose whether to approve or reject the bracket` }
  }
  const changed = await setSubmissionStatus(
    readRequiredEducator(context).id,
    params.contestId,
    params.playerId,
    parsed.data.status,
  )
  return changed
    ? { ok: true }
    : { error: `This bracket is gone or not submitted. Reload the page` }
}

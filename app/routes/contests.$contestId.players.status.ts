import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.status.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { setSubmissionStatus } from '~/contest-players.server.ts'
import { submissionStatusSchema } from '~/player-forms.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const parsed = submissionStatusSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!parsed.success) {
    return { error: `Choose whether to approve or reject the brackets` }
  }
  const count = await setSubmissionStatus(
    readRequiredEducator(context).id,
    params.contestId,
    parsed.data.playerIds,
    parsed.data.status,
  )
  if (count > 0) {
    return { ok: true }
  }
  return {
    error:
      parsed.data.playerIds.length === 1
        ? `This bracket is gone or not submitted. Reload the page`
        : `These brackets are gone or not submitted. Reload the page`,
  }
}

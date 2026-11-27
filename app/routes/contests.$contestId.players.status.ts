import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.status.ts'
import { setSubmissionStatus } from '~/contest-players.server.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { refuseChange, refuseStale } from '~/form-replies.server.ts'
import { submissionStatusSchema } from '~/player-forms.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmReply> => {
  const parsed = submissionStatusSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!parsed.success) {
    return refuseChange(`Choose whether to approve or reject the brackets`)
  }
  const count = await setSubmissionStatus(
    readRequiredEducator(context).id,
    params.contestId,
    parsed.data.ids,
    parsed.data.status,
  )
  if (count > 0) {
    return { ok: true }
  }
  return refuseStale(
    parsed.data.ids.length === 1
      ? `This bracket wasn’t changed. Reload the page`
      : `These brackets weren’t changed. Reload the page`,
  )
}

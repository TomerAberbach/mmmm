import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.approve-pending.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { approvePendingSubmissions } from '~/contest-players.server.ts'
import { approvePendingSchema } from '~/player-forms.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const parsed = approvePendingSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!parsed.success) {
    return { error: `Reload the page and try again` }
  }
  await approvePendingSubmissions(
    readRequiredEducator(context).id,
    params.contestId,
    parsed.data.playerIds,
  )
  return { ok: true }
}

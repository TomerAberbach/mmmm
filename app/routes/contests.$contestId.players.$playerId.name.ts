import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.$playerId.name.ts'
import { renamePlayer } from '~/contest-players.server.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { acceptForm, rejectForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { playerNameSchema } from '~/player-forms.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, { contestId: params.contestId }))

export const action = async ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<SavedResult | ReturnType<typeof rejectForm>> => {
  const submission = parseWithZod(await request.formData(), {
    schema: playerNameSchema(serverFreeTextSchema),
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  const renamed = await renamePlayer(
    readRequiredEducator(context).id,
    params.contestId,
    params.playerId,
    submission.value.displayName,
  )
  return renamed
    ? acceptForm(submission)
    : rejectForm(submission, {
        formErrors: [`This player is gone, so their name wasn’t saved`],
      })
}

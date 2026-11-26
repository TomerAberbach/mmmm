import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.players.$playerId.name.ts'
import { renamePlayer } from '~/contest-players.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { playerNameSchema } from '~/player-forms.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, { contestId: params.contestId }))

export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    playerNameSchema(serverFreeTextSchema),
    async ({ displayName }) => {
      const renamed = await renamePlayer(
        readRequiredEducator(context).id,
        params.contestId,
        params.playerId,
        displayName,
      )
      return renamed
        ? null
        : { formErrors: [`This player is gone, so their name wasn’t saved`] }
    },
  )

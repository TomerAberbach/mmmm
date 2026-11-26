import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.name.ts'
import { contestNameSchema } from '~/contest-forms.ts'
import { renameContest } from '~/contests.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    contestNameSchema(serverFreeTextSchema),
    async ({ name }) => {
      const renamed = await renameContest(
        readRequiredEducator(context).id,
        params.contestId,
        name,
      )
      return renamed
        ? null
        : { formErrors: [`This contest is gone, so its name wasn’t saved`] }
    },
  )

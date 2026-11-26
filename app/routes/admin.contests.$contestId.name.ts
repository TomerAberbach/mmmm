import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.contests.$contestId.name.ts'
import { renameContestAsAdmin } from '~/admin-contests.server.ts'
import { contestNameSchema } from '~/contest-forms.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { freeTextSchema } from '~/free-text.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/admin/contests/:contestId`, params))

/** Skips the offensive word filter, as admins' fields do */
export const action = ({
  request,
  params,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(request, contestNameSchema(freeTextSchema), async ({ name }) =>
    (await renameContestAsAdmin(params.contestId, name))
      ? null
      : { formErrors: [`This contest is gone, so its name wasn’t saved`] },
  )

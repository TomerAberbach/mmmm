import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.shares.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { saveForm } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'
import { shareSchema } from '~/share-forms.ts'
import { shareContest } from '~/shares.server.ts'
import type { ShareRefusal } from '~/shares.server.ts'

const REFUSAL_MESSAGES: Record<ShareRefusal, string> = {
  NO_CONTEST: `This contest is gone, so it wasn’t shared`,
  NO_COLLEAGUE: `No one in your organization signed up with this email address`,
  OWN_ADDRESS: `This is your own email address. Enter a colleague’s`,
}

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = ({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<SavedResult | FormRejection> =>
  saveForm(
    request,
    shareSchema,
    async ({ email }) => {
      const refusal = await shareContest(
        readRequiredEducator(context).id,
        params.contestId,
        email,
      )
      return refusal && { fieldErrors: { email: [REFUSAL_MESSAGES[refusal]] } }
    },
    { resetForm: true },
  )

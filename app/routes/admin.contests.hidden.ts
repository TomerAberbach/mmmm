import { href, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/admin.contests.hidden.ts'
import { setContestHidden } from '~/admin-contests.server.ts'
import type { ConfirmReply } from '~/form-replies.server.ts'
import { refuseStale } from '~/form-replies.server.ts'

const HIDDEN_SCHEMA = z.object({
  contestId: z.string(),
  isHidden: z.enum([`true`, `false`]).transform(value => value === `true`),
})

export const loader = (): Response => redirect(href(`/admin/contests`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmReply> => {
  const { data } = HIDDEN_SCHEMA.safeParse(
    Object.fromEntries(await request.formData()),
  )
  return data && (await setContestHidden(data.contestId, data.isHidden))
    ? { ok: true }
    : refuseStale(`This contest can’t be hidden or shown now. Reload the page`)
}

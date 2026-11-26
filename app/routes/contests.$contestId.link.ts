import { href, redirect } from 'react-router'
import type { Route } from './+types/contests.$contestId.link.ts'
import { replaceContestLink } from '~/contests.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { readRequiredEducator } from '~/session.server.ts'

export const loader = ({ params }: Route.LoaderArgs): Response =>
  redirect(href(`/contests/:contestId`, params))

export const action = async ({
  context,
  params,
}: Route.ActionArgs): Promise<ConfirmResult> =>
  (await replaceContestLink(readRequiredEducator(context).id, params.contestId))
    ? { ok: true }
    : { error: `The contest link wasn’t replaced. Reload the page` }

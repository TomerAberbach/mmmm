import { href, redirect } from 'react-router'
import type { Route } from './+types/admin.results.reopen.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'
import { reopenSubmissions } from '~/results.server.ts'

export const loader = (): Response => redirect(href(`/admin/results`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const year = Number((await request.formData()).get(`year`))
  switch (await reopenSubmissions(year)) {
    case `REOPENED`:
      return { ok: true }
    case `HAS_RESULTS`:
      return { error: `Clear every result before reopening submissions` }
    case `UNCHANGED`:
      return { error: `Submissions aren’t locked. Reload the page` }
  }
}

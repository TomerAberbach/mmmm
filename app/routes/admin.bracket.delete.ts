import { href, redirect } from 'react-router'
import { deleteUnpublishedBracket } from '~/brackets.server.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { readUpcomingYear } from '~/year.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

export const action = async (): Promise<Response | ConfirmResult> => {
  const year = readUpcomingYear(new Date())
  return (await deleteUnpublishedBracket(year))
    ? redirect(href(`/admin`))
    : { error: `The ${year} bracket is already published or deleted` }
}

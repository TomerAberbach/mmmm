import { href, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/admin.bracket.publication.ts'
import { setBracketPublished } from '~/brackets.server.ts'
import type { ConfirmResult } from '~/components/confirm-dialog.tsx'
import { readUpcomingYear } from '~/year.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

const publicationSchema = z.object({
  published: z.enum([`true`, `false`]).transform(value => value === `true`),
})

export const action = async ({
  request,
}: Route.ActionArgs): Promise<ConfirmResult> => {
  const parsed = publicationSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!parsed.success) {
    return { error: `Choose whether to publish or unpublish the bracket` }
  }
  const { published } = parsed.data
  const year = readUpcomingYear(new Date())
  switch (await setBracketPublished(year, published)) {
    case `CHANGED`:
      return { ok: true }
    case `UNCHANGED`:
      return {
        error: `The ${year} bracket is already ${published ? `published` : `unpublished`} or deleted`,
      }
    case `HAS_CONTESTS`:
      return {
        error: `Educators have created ${year} contests, so the bracket stays published`,
      }
  }
}

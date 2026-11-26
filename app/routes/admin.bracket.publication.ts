import { href, redirect } from 'react-router'
import { z } from 'zod'
import type { Route } from './+types/admin.bracket.publication.ts'
import { readAdminYears, setBracketPublished } from '~/brackets.server.ts'
import type { ConfirmResult } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/admin/bracket`))

const publicationSchema = z.object({
  /** The year on the page, which may no longer be the one the action changes */
  year: z.coerce.number<string>().int(),
  /** Of the bracket on the page, which Publish must match */
  seenVersion: z.string().default(``),
  published: z.enum([`true`, `false`]).transform(value => value === `true`),
})

export const action = async ({
  request,
}: Route.ActionArgs): Promise<Response | ConfirmResult> => {
  const parsed = publicationSchema.safeParse(
    Object.fromEntries(await request.formData()),
  )
  if (!parsed.success) {
    return { error: `Choose whether to publish or unpublish the bracket` }
  }
  const { published, seenVersion } = parsed.data
  const { current, setupYear } = await readAdminYears()
  const year = published ? setupYear : (current?.year ?? null)
  if (year === null || year !== parsed.data.year) {
    return {
      error: `The ${parsed.data.year} bracket can’t be ${published ? `published` : `unpublished`} now. Reload the page`,
    }
  }
  switch (await setBracketPublished(year, published, seenVersion)) {
    // The bracket moves to the other page
    case `CHANGED`:
      return redirect(href(published ? `/admin/results` : `/admin/bracket`))
    case `UNCHANGED`:
      return {
        error: `The ${year} bracket is already ${published ? `published` : `unpublished`} or deleted. Reload the page`,
      }
    case `STALE`:
      return {
        error: `This bracket changed since the page loaded. Reload the page`,
      }
    case `PAST`:
      return { error: `The ${year} bracket is archived. Reload the page` }
    case `HAS_CONTESTS`:
      return {
        error: `Educators have created ${year} contests, so the bracket stays published. Reload the page`,
      }
    case `NO_CHAMPION`:
      return {
        error: `Record the current year’s champion before publishing the ${year} bracket`,
      }
    case `LOCKED`:
      return {
        error: `Submissions are locked, so the ${year} bracket stays published. Reload the page`,
      }
  }
}

import { parseWithZod } from '@conform-to/zod/v4'
import { href, redirect } from 'react-router'
import type { Route } from './+types/settings.name.ts'
import { nameSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { acceptForm, rejectForm } from '~/form-replies.server.ts'
import { serverFreeTextSchema } from '~/free-text.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<SavedResult | ReturnType<typeof rejectForm>> => {
  const submission = parseWithZod(await request.formData(), {
    schema: nameSchema(serverFreeTextSchema),
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }

  await auth.api.updateUser({
    body: { name: submission.value.name },
    headers: request.headers,
  })
  return acceptForm(submission)
}

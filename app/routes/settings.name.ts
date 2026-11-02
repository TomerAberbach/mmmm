import { parseWithZod } from '@conform-to/zod/v4'
import { redirect } from 'react-router'
import type { Route } from './+types/settings.name.ts'
import { serverNameSchema } from '~/auth-forms.server.ts'
import { auth } from '~/auth.server.ts'
import type { SavedResult } from '~/form-replies.server.ts'
import { acceptSubmission, rejectSubmission } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(`/settings`)

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  SavedResult | ReturnType<typeof rejectSubmission>
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: serverNameSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }

  await auth.api.updateUser({
    body: { name: submission.value.name },
    headers: request.headers,
  })
  return acceptSubmission(submission)
}

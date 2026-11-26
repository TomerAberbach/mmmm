import { parseWithZod } from '@conform-to/zod/v4'
import { data, href, redirect } from 'react-router'
import type { Route } from './+types/settings.password.ts'
import { changePasswordSchema } from '~/auth-forms.ts'
import { rejectAuthError } from '~/auth-replies.server.ts'
import { auth } from '~/auth.server.ts'
import type { FormRejection, SavedResult } from '~/form-replies.server.ts'
import { acceptForm, rejectForm } from '~/form-replies.server.ts'

export const loader = (): Response => redirect(href(`/settings`))

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  ReturnType<typeof data<SavedResult>> | FormRejection
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: changePasswordSchema,
  })
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }

  const { currentPassword, newPassword } = submission.value
  try {
    // Signing out the other sessions replaces this one's cookie
    const { headers } = await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: request.headers,
      returnHeaders: true,
    })
    return data(acceptForm(submission, { resetForm: true }), {
      headers,
    })
  } catch (error) {
    return rejectAuthError(submission, error, {
      passwordField: `currentPassword`,
    })
  }
}

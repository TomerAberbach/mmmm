import { parseWithZod } from '@conform-to/zod/v4'
import { APIError } from 'better-auth/api'
import { data, redirect } from 'react-router'
import type { Route } from './+types/settings.password.ts'
import { changePasswordSchema } from '~/auth-forms.ts'
import { auth } from '~/auth.server.ts'
import type { SavedResult } from '~/components/saved-notice.tsx'
import { rejectSubmission } from '~/reject-submission.server.ts'

export const loader = (): Response => redirect(`/settings`)

export const action = async ({
  request,
}: Route.ActionArgs): Promise<
  ReturnType<typeof data<SavedResult>> | ReturnType<typeof rejectSubmission>
> => {
  const submission = parseWithZod(await request.formData(), {
    schema: changePasswordSchema,
  })
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }

  const { currentPassword, newPassword } = submission.value
  try {
    // Signing out the other sessions replaces this one's cookie
    const { headers } = await auth.api.changePassword({
      body: { currentPassword, newPassword },
      headers: request.headers,
      returnHeaders: true,
    })
    return data(
      {
        result: submission.reply({ resetForm: true }),
        saved: true,
      },
      { headers },
    )
  } catch (error) {
    if (error instanceof APIError && error.body?.code === `INVALID_PASSWORD`) {
      return rejectSubmission(submission, {
        fieldErrors: {
          currentPassword: [`Your current password is incorrect`],
        },
      })
    }
    throw error
  }
}

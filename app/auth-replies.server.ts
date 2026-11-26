import type { Submission } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { readRefusal } from './app-refusal.server.ts'
import { rejectForm } from './form-replies.server.ts'
import type { FormRejection } from './form-replies.server.ts'

/**
 * Answers a refusal the app wrote, or a wrong password in `passwordField`, and
 * rethrows any other error
 */
export const rejectAuthError = (
  submission: Submission<unknown>,
  error: unknown,
  { passwordField }: { passwordField?: string } = {},
): FormRejection => {
  if (!(error instanceof APIError)) {
    throw error
  }
  const message = readRefusal(error)
  if (message !== undefined) {
    return rejectForm(
      submission,
      { formErrors: [message] },
      { status: error.statusCode, headers: error.headers },
    )
  }
  // Better Auth refuses a password too long to be anyone's before checking it
  if (
    passwordField &&
    (error.body?.code === `INVALID_PASSWORD` ||
      error.body?.code === `PASSWORD_TOO_LONG`)
  ) {
    return rejectForm(submission, {
      fieldErrors: { [passwordField]: [`Your password is incorrect`] },
    })
  }
  throw error
}

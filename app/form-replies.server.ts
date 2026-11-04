import type { Submission, SubmissionResult } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { data } from 'react-router'
import { INVALID_EMAIL_MESSAGE } from './auth-forms.ts'
import { isTooManyAttempts } from './auth-limits.server.ts'
import { isSecondFactorRefusal } from './second-factor.ts'

// What an action answers once it saves a form submitted through a fetcher
export type SavedResult = { result: SubmissionResult; saved?: true }

const BAD_REQUEST: ResponseInit = { status: 400 }

// The reply never sends a password back to the browser, so it drops every
// field whose name mentions one
export const rejectForm = (
  submission: Submission<unknown>,
  errors: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[]>
  } = {},
  init: ResponseInit = BAD_REQUEST,
): ReturnType<typeof data<{ result: SubmissionResult }>> =>
  data(
    {
      result: submission.reply({
        ...errors,
        hideFields: readPasswordFields(submission),
      }),
    },
    init,
  )

export const acceptForm = (
  submission: Submission<unknown>,
  options?: { resetForm?: boolean },
): SavedResult => ({ result: submission.reply(options), saved: true })

// Answers each refusal Better Auth gives a form, and rethrows any other error:
// too many attempts, an address it checks more strictly than `emailSchema`, a
// second-factor change the app refuses, or a wrong password in
// `passwordField`
export const rejectAuthError = (
  submission: Submission<unknown>,
  error: unknown,
  { passwordField }: { passwordField?: string } = {},
): ReturnType<typeof rejectForm> => {
  if (isTooManyAttempts(error)) {
    return rejectForm(
      submission,
      { formErrors: [error.body.message] },
      { status: 429, headers: error.headers },
    )
  }
  if (error instanceof APIError && error.body?.code === `INVALID_EMAIL`) {
    return rejectForm(submission, {
      fieldErrors: { email: [INVALID_EMAIL_MESSAGE] },
    })
  }
  if (
    passwordField &&
    error instanceof APIError &&
    error.body?.code === `INVALID_PASSWORD`
  ) {
    return rejectForm(submission, {
      fieldErrors: { [passwordField]: [`Your password is incorrect`] },
    })
  }
  if (error instanceof APIError && isSecondFactorRefusal(error.body?.code)) {
    return rejectForm(
      submission,
      { formErrors: [error.body?.message ?? error.message] },
      { status: error.statusCode },
    )
  }
  throw error
}

const readPasswordFields = (submission: Submission<unknown>): string[] =>
  Object.keys(submission.payload).filter(name => /password/iu.test(name))

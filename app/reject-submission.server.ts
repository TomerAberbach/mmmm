import type { Submission, SubmissionResult } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { data } from 'react-router'
import { INVALID_EMAIL_MESSAGE } from './auth-forms.ts'
import { isTooManyAttempts } from './auth-limits.server.ts'

const BAD_REQUEST: ResponseInit = { status: 400 }

// The reply never sends a password back to the browser, so it drops every
// field whose name mentions one
export const rejectSubmission = (
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

// Answers each refusal Better Auth gives a form, and rethrows any other error:
// too many attempts, or an address it checks more strictly than `emailSchema`
export const rejectAuthError = (
  submission: Submission<unknown>,
  error: unknown,
): ReturnType<typeof rejectSubmission> => {
  if (isTooManyAttempts(error)) {
    return rejectSubmission(
      submission,
      { formErrors: [error.body.message] },
      { status: 429, headers: error.headers },
    )
  }
  if (error instanceof APIError && error.body?.code === `INVALID_EMAIL`) {
    return rejectSubmission(submission, {
      fieldErrors: { email: [INVALID_EMAIL_MESSAGE] },
    })
  }
  throw error
}

const readPasswordFields = (submission: Submission<unknown>): string[] =>
  Object.keys(submission.payload).filter(name => /password/iu.test(name))

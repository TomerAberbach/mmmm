import type { Submission, SubmissionResult } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { data } from 'react-router'
import { INVALID_EMAIL_MESSAGE } from './auth-forms.ts'

// The reply never sends a password back to the browser, so it drops every
// field whose name mentions one
export const rejectSubmission = (
  submission: Submission<unknown>,
  errors: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[]>
  } = {},
): ReturnType<typeof data<{ result: SubmissionResult }>> =>
  data(
    {
      result: submission.reply({
        ...errors,
        hideFields: readPasswordFields(submission),
      }),
    },
    { status: 400 },
  )

// Better Auth checks addresses more strictly than `emailSchema`, so this
// rejects an address it refused and rethrows any other error
export const rejectRefusedEmail = (
  submission: Submission<unknown>,
  error: unknown,
): ReturnType<typeof rejectSubmission> => {
  if (error instanceof APIError && error.body?.code === `INVALID_EMAIL`) {
    return rejectSubmission(submission, {
      fieldErrors: { email: [INVALID_EMAIL_MESSAGE] },
    })
  }
  throw error
}

const readPasswordFields = (submission: Submission<unknown>): string[] =>
  Object.keys(submission.payload).filter(name => /password/iu.test(name))

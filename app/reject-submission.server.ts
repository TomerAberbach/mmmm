import type { Submission, SubmissionResult } from '@conform-to/react'
import { data } from 'react-router'

// The reply never sends a password back to the browser
export const rejectSubmission = (
  submission: Submission<unknown>,
  errors: {
    formErrors?: string[]
    fieldErrors?: Record<string, string[]>
  } = {},
): ReturnType<typeof data<{ result: SubmissionResult }>> =>
  data(
    { result: submission.reply({ ...errors, hideFields: [`password`] }) },
    { status: 400 },
  )

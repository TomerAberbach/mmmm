import type { Submission } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { redirect } from 'react-router'
import { rejectAuthError, rejectSubmission } from './form-replies.server.ts'
import { EDUCATOR_DASHBOARD_PATH } from './paths.ts'

// Sign-in sends an educator with an authenticator app here with a cookie that
// lasts 10 minutes and allows 5 codes. Once it runs out, they start over
const SIGN_IN_AGAIN = `/sign-in?challenge-expired`

// Signs in once `verify` accepts the code, or answers why it didn't
export const answerSignInChallenge = async (
  submission: Submission<{ code: string }>,
  verify: (code: string) => Promise<{ headers: Headers }>,
  invalidMessage: string,
): Promise<Response | ReturnType<typeof rejectSubmission>> => {
  if (submission.status !== `success`) {
    return rejectSubmission(submission)
  }
  try {
    const { headers } = await verify(submission.value.code)
    return redirect(EDUCATOR_DASHBOARD_PATH, { headers })
  } catch (error) {
    return rejectChallenge(submission, error, invalidMessage)
  }
}

// Answers a code Better Auth refused: a wrong code, a challenge that ran out,
// or an account locked after too many wrong codes
const rejectChallenge = (
  submission: Submission<{ code: string }>,
  error: unknown,
  invalidMessage: string,
): Response | ReturnType<typeof rejectSubmission> => {
  const code = error instanceof APIError ? error.body?.code : undefined
  if (code === `INVALID_CODE` || code === `INVALID_BACKUP_CODE`) {
    return rejectSubmission(submission, {
      fieldErrors: { code: [invalidMessage] },
    })
  }
  if (
    code === `INVALID_TWO_FACTOR_COOKIE` ||
    code === `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`
  ) {
    return redirect(SIGN_IN_AGAIN)
  }
  return code === `ACCOUNT_TEMPORARILY_LOCKED`
    ? rejectSubmission(
        submission,
        {
          formErrors: [`Too many incorrect codes. Try again in 15 minutes.`],
        },
        { status: 429 },
      )
    : rejectAuthError(submission, error)
}

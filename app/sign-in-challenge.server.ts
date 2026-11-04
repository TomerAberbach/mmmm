import type { Submission } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { href, redirect } from 'react-router'
import { rejectAuthError, rejectForm } from './form-replies.server.ts'

// Sign-in sends an educator with an authenticator app here with a cookie that
// lasts 10 minutes and allows 5 codes. Once it runs out, they start over
const SIGN_IN_AGAIN = `${href(`/sign-in`)}?challenge-expired`

// Signs in once `verify` accepts the code, or answers why it didn't
export const answerSignInChallenge = async (
  submission: Submission<{ code: string }>,
  verify: (code: string) => Promise<{ headers: Headers }>,
  invalidMessage: string,
): Promise<Response | ReturnType<typeof rejectForm>> => {
  if (submission.status !== `success`) {
    return rejectForm(submission)
  }
  try {
    const { headers } = await verify(submission.value.code)
    return redirect(href(`/contests`), { headers })
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
): Response | ReturnType<typeof rejectForm> => {
  const code = error instanceof APIError ? error.body?.code : undefined
  if (code === `INVALID_CODE` || code === `INVALID_BACKUP_CODE`) {
    return rejectForm(submission, {
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
    ? rejectForm(
        submission,
        {
          formErrors: [`Too many incorrect codes. Try again in 15 minutes.`],
        },
        { status: 429 },
      )
    : rejectAuthError(submission, error)
}

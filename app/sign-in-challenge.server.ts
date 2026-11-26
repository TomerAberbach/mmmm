import type { Submission } from '@conform-to/react'
import { APIError } from 'better-auth/api'
import { href, redirect } from 'react-router'
import { rejectAuthError } from './auth-replies.server.ts'
import { rejectForm } from './form-replies.server.ts'
import type { FormRejection } from './form-replies.server.ts'

/**
 * Sign-in sends an educator with an authenticator app here with a cookie that
 * lasts 10 minutes and allows 5 codes. Once it runs out, they start over
 */
const SIGN_IN_AGAIN = `${href(`/sign-in`)}?challenge-expired`

/** The notice for a sign-in that ran out of codes */
const TOO_MANY_CODES = `${href(`/sign-in`)}?too-many-codes`

/** Signs in once `verify` accepts the code, or answers why it didn't */
export const answerSignInChallenge = async (
  submission: Submission<{ code: string }>,
  verify: (code: string) => Promise<{ headers: Headers }>,
  invalidMessage: string,
): Promise<Response | FormRejection> => {
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

/**
 * Answers a code Better Auth refused: a wrong code, a challenge that ran out
 * of time or codes, an authenticator app that was removed meanwhile, a recovery
 * code another tab was using, or an account locked after too many wrong codes
 */
const rejectChallenge = (
  submission: Submission<{ code: string }>,
  error: unknown,
  invalidMessage: string,
): Response | FormRejection => {
  const code = error instanceof APIError ? error.body?.code : undefined
  if (code === `INVALID_CODE` || code === `INVALID_BACKUP_CODE`) {
    return rejectForm(submission, {
      fieldErrors: { code: [invalidMessage] },
    })
  }
  if (code === `TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE`) {
    return redirect(TOO_MANY_CODES)
  }
  if (
    code === `INVALID_TWO_FACTOR_COOKIE` ||
    code === `TOTP_NOT_ENABLED` ||
    code === `BACKUP_CODES_NOT_ENABLED` ||
    // Another sign-in used a recovery code meanwhile. Better Auth refuses every
    // later code of this one
    (error instanceof APIError && error.status === `CONFLICT`)
  ) {
    return redirect(SIGN_IN_AGAIN)
  }
  return code === `ACCOUNT_TEMPORARILY_LOCKED`
    ? rejectForm(
        submission,
        {
          formErrors: [
            `Too many incorrect codes. Wait up to 15 minutes, then try again`,
          ],
        },
        { status: 429 },
      )
    : rejectAuthError(submission, error)
}

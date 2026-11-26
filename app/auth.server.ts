import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import type { GenericEndpointContext } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import {
  APIError,
  createAuthMiddleware,
  getSessionFromCtx,
} from 'better-auth/api'
import { twoFactor } from 'better-auth/plugins'
import { href } from 'react-router'
import { readRefusal, refuse } from './app-refusal.server.ts'
import {
  CONFIRMATION_EXPIRES_IN_DAYS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RESET_EXPIRES_IN_HOURS,
} from './auth-forms.ts'
import {
  limitAuthRequest,
  PASSWORD_PROMPT_PATHS,
  refundAuthRequest,
} from './auth-limits.server.ts'
import { prisma } from './db.server.ts'
import { freeAddress } from './educator-deletion.server.ts'
import { sendEmail, sendEmailOrLog, sendNoticeOrLog } from './email.server.ts'
import { alreadySignedUpEmail } from './emails/already-signed-up.server.tsx'
import { confirmEmail } from './emails/confirm-email.server.tsx'
import { passwordChangedEmail } from './emails/password-changed.server.tsx'
import { resetPasswordEmail } from './emails/reset-password.server.tsx'
import { secondFactorChangedEmail } from './emails/second-factor-changed.server.tsx'
import type { SecondFactorChange } from './emails/second-factor-changed.server.tsx'
import { requireEnv } from './env.server.ts'
import { SessionAssurance } from './generated/prisma/enums.ts'
import { joinOrganization } from './organizations.server.ts'
import {
  guardSecondFactorChange,
  LAST_SECOND_FACTOR_MESSAGE,
  markSecondFactorUsed,
  releaseAuthenticatorApp,
  SECOND_FACTOR_SIGN_IN_PATHS,
} from './second-factor.server.ts'
import type { SessionProof } from './second-factor.server.ts'

const BASE_URL = requireEnv(`BETTER_AUTH_URL`)
const CONFIRMATION_EXPIRES_IN_SECONDS =
  CONFIRMATION_EXPIRES_IN_DAYS * 24 * 60 * 60

/** Counted from the last renewal, which an educator's visits trigger */
const SESSION_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60

/**
 * Every confirmation link returns to sign-in, whatever the request asked for.
 * Sign-in shows whether the link worked
 */
const CONFIRMED_CALLBACK_URL = `${href(`/sign-in`)}?confirmed`

/** Fields that the app's routes leave out, and that no browser may choose */
const FORCED_FIELDS: Record<string, Record<string, unknown>> = {
  '/sign-up/email': { callbackURL: CONFIRMED_CALLBACK_URL },
  '/send-verification-email': { callbackURL: CONFIRMED_CALLBACK_URL },
  // A reset link returns here with its token, or with `error` when it fails
  '/request-password-reset': { redirectTo: href(`/reset-password`) },
  // Whoever knew the old password loses access, however it changed
  '/change-password': { revokeOtherSessions: true },
  // Registering a passkey never signs in, so it can't make a session that
  // counts as having used a second factor. Pages label passkeys by their
  // provider, so they take no name that would need the offensive word filter.
  // Better Auth stores an empty name as none, and an undefined one here would
  // keep the client's
  '/passkey/verify-registration': { createSession: false, name: `` },
}

const beforeAuthRequest = createAuthMiddleware(async ctx => {
  await guardSecondFactorChange(ctx)
  const body = ctx.body as Record<string, unknown> | undefined
  if (!body) {
    return
  }
  await limitAuthRequest({
    path: ctx.path,
    email: await readLimitedEmail(ctx),
    headers: ctx.headers,
  })
  if (ctx.path === `/sign-up/email`) {
    // Otherwise Better Auth keeps the password of whoever signed up first, who
    // may not own the address, and emails its owner no confirmation link
    await freeAddress(body.email as string)
  }
  return { context: { body: { ...body, ...FORCED_FIELDS[ctx.path] } } }
})

/** A password prompt has no address, so it counts for the signed-in educator's */
const readLimitedEmail = async (
  ctx: GenericEndpointContext,
): Promise<unknown> =>
  PASSWORD_PROMPT_PATHS.has(ctx.path)
    ? (await getSessionFromCtx(ctx))?.user.email
    : (ctx.body as Record<string, unknown> | undefined)?.email

/**
 * Refunds the attempts of a request whose password was right. Notifies the owner
 * however the password or a passkey changed, so a stolen session can't change
 * either quietly
 */
const afterAuthRequest = createAuthMiddleware(async ctx => {
  const { returned, newSession } = ctx.context
  const failed = returned instanceof APIError
  // Only a sign-in that made a session succeeded, whatever the response says. A
  // password prompt answers a wrong password with an error
  const hadRightPassword = PASSWORD_PROMPT_PATHS.has(ctx.path)
    ? !failed || followsRightPassword(returned)
    : !failed && newSession
  if (hadRightPassword) {
    await refundAuthRequest({
      path: ctx.path,
      email: await readLimitedEmail(ctx),
      headers: ctx.headers,
    })
  }
  if (failed) {
    return
  }
  const educator = ctx.context.session?.user
  if (!educator) {
    return
  }
  if (ctx.path === `/change-password`) {
    notifyPasswordChanged(educator.email)
  }
  if (ctx.path === `/passkey/verify-registration`) {
    await markPasskeyUsed(ctx)
    notifySecondFactorChanged(educator.email, `passkey-added`)
  }
})

/**
 * Whether a password prompt's error comes only after the right password. Any
 * other error may follow a wrong one, or come before the attempt was counted
 */
const followsRightPassword = (error: APIError): boolean =>
  error.body?.code === `TOTP_ALREADY_ENABLED` ||
  readRefusal(error) === LAST_SECOND_FACTOR_MESSAGE

/**
 * The session that adds a passkey counts as having used it, so setting up the
 * first one opens the admin area without signing in again. Better Auth makes a
 * new session when an authenticator app turns on, which the session hook
 * marks
 */
const markPasskeyUsed = async (ctx: GenericEndpointContext): Promise<void> => {
  const session = ctx.context.session?.session
  if (session) {
    await markSecondFactorUsed(session.id)
  }
}

const notifySecondFactorChanged = (
  to: string,
  change: SecondFactorChange,
): void => {
  void sendNoticeOrLog(secondFactorChangedEmail({ to, change }))
}

/**
 * Better Auth updates `twoFactorEnabled` only when an authenticator app turns
 * on or off
 */
const AUTHENTICATOR_APP_CHANGES: Record<string, SecondFactorChange> = {
  '/two-factor/verify-totp': `authenticator-app-added`,
  '/two-factor/disable': `authenticator-app-removed`,
}

const BASE_ORIGIN = new URL(BASE_URL)

/** Doesn't wait for the email, which can't undo the change */
const notifyPasswordChanged = (to: string): void => {
  void sendNoticeOrLog(passwordChangedEmail({ to }))
}

/**
 * Changing the password replaces the session that changed it, and the new
 * session keeps exactly what the old one proved
 */
const readProof = (
  ctx: GenericEndpointContext,
): Pick<SessionProof, `assurance` | `secondFactorUsedAt`> => {
  const session: SessionProof | undefined = ctx.context.session?.session
  return {
    assurance: session?.assurance ?? `PASSWORD`,
    secondFactorUsedAt: session?.secondFactorUsedAt ?? null,
  }
}

export const auth = betterAuth({
  baseURL: BASE_URL,
  secret: requireEnv(`BETTER_AUTH_SECRET`),
  database: prismaAdapter(prisma, { provider: `postgresql` }),
  user: { modelName: `educator` },
  account: { modelName: `credential`, fields: { userId: `educatorId` } },
  hooks: { before: beforeAuthRequest, after: afterAuthRequest },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    // Sign-up doesn't sign in, and answers an existing address the same as a
    // new one
    requireEmailVerification: true,
    // Only educators that `freeAddress` keeps reach this
    onExistingUserSignUp: async ({ user }) => {
      await sendEmail(alreadySignedUpEmail({ to: user.email }))
    },
    resetPasswordTokenExpiresIn: RESET_EXPIRES_IN_HOURS * 60 * 60,
    // Doesn't wait for the email, so a known address answers as fast as an
    // unknown one, which gets no email
    sendResetPassword: ({ user, url }) => {
      void sendEmailOrLog(resetPasswordEmail({ to: user.email, url }))
      return Promise.resolve()
    },
    // Only the address's owner receives a reset link, so using one confirms
    // the address
    onPasswordReset: async ({ user }) => {
      await prisma.educator.update({
        where: { id: user.id },
        data: { emailVerified: true },
      })
      // An older link could otherwise set the password again
      await prisma.verification.deleteMany({
        where: {
          identifier: { startsWith: `reset-password:` },
          value: user.id,
        },
      })
      notifyPasswordChanged(user.email)
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    // Signing in to an unconfirmed educator sends nothing, so whoever set its
    // password can't flood the address. The educator resends from the page
    // sign-in shows, which the resend limit counts
    sendOnSignIn: false,
    // Off because whoever set the password may not own the address. A
    // confirmed educator still signs in with the password
    autoSignInAfterVerification: false,
    expiresIn: CONFIRMATION_EXPIRES_IN_SECONDS,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(confirmEmail({ to: user.email, url }))
    },
  },
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    fields: { userId: `educatorId` },
    // No default, so a session Better Auth makes in place of another keeps
    // its assurance. The database defaults a new one to PASSWORD
    additionalFields: {
      assurance: {
        type: Object.values(SessionAssurance),
        required: false,
        input: false,
      },
      secondFactorUsedAt: { type: `date`, required: false, input: false },
    },
  },
  plugins: [
    twoFactor({
      issuer: `MMMM`,
      schema: {
        twoFactor: {
          modelName: `authenticatorApp`,
          fields: { userId: `educatorId` },
        },
      },
    }),
    passkey({
      rpID: BASE_ORIGIN.hostname,
      rpName: `MMMM`,
      // Without it, Better Auth checks responses against the request's own
      // Origin header
      origin: BASE_ORIGIN.origin,
      // A passkey replaces the password and the second factor at once, so it
      // must check a fingerprint, face, or PIN itself
      authenticatorSelection: {
        residentKey: `required`,
        userVerification: `required`,
      },
      registration: {
        afterVerification: ({ verification }) => {
          requireUserVerified(verification.registrationInfo?.userVerified)
          return undefined
        },
      },
      authentication: {
        afterVerification: ({ verification }) => {
          requireUserVerified(verification.authenticationInfo.userVerified)
        },
      },
      schema: { passkey: { fields: { userId: `educatorId` } } },
    }),
  ],
  // Off because its limit of 3 sign-ins per 10 seconds per IP address would
  // block a school that shares one address
  rateLimit: { enabled: false },
  databaseHooks: {
    session: {
      create: {
        // However an educator confirms their address, they sign in after
        after: session => joinOrganization(session.userId),
        // Nothing stores IP addresses or browsers
        before: (session, ctx) =>
          Promise.resolve({
            data: {
              ...session,
              ipAddress: null,
              userAgent: null,
              ...(ctx && SECOND_FACTOR_SIGN_IN_PATHS.has(ctx.path)
                ? {
                    assurance: `SECOND_FACTOR`,
                    secondFactorUsedAt: new Date(),
                  }
                : {}),
              ...(ctx?.path === `/change-password` && readProof(ctx)),
            },
          }),
      },
    },
    user: {
      update: {
        before: async (_changes, ctx) => {
          if (ctx?.path === `/two-factor/disable` && ctx.context.session) {
            await releaseAuthenticatorApp(ctx.context.session.user.id)
          }
        },
        after: (educator, ctx) => {
          const change = ctx && AUTHENTICATOR_APP_CHANGES[ctx.path]
          if (change) {
            notifySecondFactorChanged(educator.email, change)
          }
          return Promise.resolve()
        },
      },
    },
  },
})

const requireUserVerified = (userVerified: boolean | undefined): void => {
  if (!userVerified) {
    throw refuse(
      `BAD_REQUEST`,
      `Use a passkey that checks your fingerprint, face, or PIN`,
    )
  }
}

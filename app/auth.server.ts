import { passkey } from '@better-auth/passkey'
import { betterAuth } from 'better-auth'
import type { AuthContext, GenericEndpointContext } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { verifyJWT } from 'better-auth/crypto'
import { twoFactor } from 'better-auth/plugins'
import {
  CONFIRMATION_EXPIRES_IN_DAYS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RESET_EXPIRES_IN_HOURS,
} from './auth-forms.ts'
import { limitAuthRequest, refundAuthRequest } from './auth-limits.server.ts'
import { prisma } from './db.server.ts'
import { sendEmail, sendEmailOrLog, sendNoticeOrLog } from './email.server.ts'
import { alreadySignedUpEmail } from './emails/already-signed-up.server.tsx'
import { confirmEmail } from './emails/confirm-email.server.tsx'
import { passwordChangedEmail } from './emails/password-changed.server.tsx'
import { resetPasswordEmail } from './emails/reset-password.server.tsx'
import { secondFactorChangedEmail } from './emails/second-factor-changed.server.tsx'
import type { SecondFactorChange } from './emails/second-factor-changed.server.tsx'
import { requireEnv } from './env.server.ts'
import { serverFreeTextSchema } from './free-text.server.ts'
import { EDUCATOR_NAME } from './free-text.ts'
import { SessionAssurance } from './generated/prisma/enums.ts'
import {
  guardSecondFactorChange,
  markSecondFactorUsed,
  SECOND_FACTOR_SIGN_IN_PATHS,
} from './second-factor.server.ts'

const BASE_URL = requireEnv(`BETTER_AUTH_URL`)
const CONFIRMATION_EXPIRES_IN_SECONDS =
  CONFIRMATION_EXPIRES_IN_DAYS * 24 * 60 * 60

const SIGN_IN_URL = new URL(`/sign-in`, BASE_URL)
const SETTINGS_URL = new URL(`/settings`, BASE_URL)
const FORGOT_PASSWORD_URL = new URL(`/forgot-password`, BASE_URL)
// Every confirmation link returns to sign-in, whatever the request asked for.
// Sign-in shows whether the link worked
const CONFIRMED_CALLBACK_URL = `${SIGN_IN_URL.pathname}?confirmed`

// Clients can't choose where emailed links return, or keep their other
// sessions through a password change
const FORCED_FIELDS: Record<string, Record<string, unknown>> = {
  '/sign-up/email': { callbackURL: CONFIRMED_CALLBACK_URL },
  '/sign-in/email': { callbackURL: CONFIRMED_CALLBACK_URL },
  '/send-verification-email': { callbackURL: CONFIRMED_CALLBACK_URL },
  // A reset link returns here with its token, or with `error` when it fails
  '/request-password-reset': { redirectTo: `/reset-password` },
  // Whoever knew the old password loses access, however it changed
  '/change-password': { revokeOtherSessions: true },
  // Every sign-in asks for the second factor. NIST SP 800-63B forbids
  // remembering a browser in place of authenticating
  '/two-factor/verify-totp': { trustDevice: false },
  '/two-factor/verify-backup-code': { trustDevice: false },
  // Registering a passkey never signs in, so it can't make a session that
  // counts as having used a second factor. Pages label passkeys by their
  // provider, so they take no name that would need the offensive word filter.
  // Better Auth stores an empty name as none, and an undefined one here would
  // keep the client's
  '/passkey/verify-registration': { createSession: false, name: `` },
}

const EDUCATOR_NAME_SCHEMA = serverFreeTextSchema(EDUCATOR_NAME)
const PATHS_WITH_NAME = new Set([`/sign-up/email`, `/update-user`])

const beforeAuthRequest = createAuthMiddleware(async ctx => {
  if (
    ctx.path === `/verify-email` &&
    (await isOlderThanEducator(ctx.context, ctx.query?.token))
  ) {
    throw ctx.redirect(`${CONFIRMED_CALLBACK_URL}&error=INVALID_TOKEN`)
  }
  await guardSecondFactorChange(ctx)
  let body = ctx.body as Record<string, unknown> | undefined
  if (!body) {
    return
  }
  await limitAuthRequest({
    path: ctx.path,
    email: body.email,
    headers: ctx.headers,
  })
  // Checks the name before sign-up looks up the address, so a rejected name
  // answers the same whether or not the address has an educator
  if (PATHS_WITH_NAME.has(ctx.path) && body.name !== undefined) {
    body = { ...body, name: await parseName(body.name) }
  }
  if (ctx.path === `/sign-up/email` && typeof body.email === `string`) {
    await deleteUnconfirmedEducator(ctx.context.internalAdapter, body.email)
  }
  return { context: { body: { ...body, ...FORCED_FIELDS[ctx.path] } } }
})

// A confirmation link contains only the address, so without this check a link
// sent before sign-up started over would confirm the new educator's password.
// Remove once Better Auth ships https://github.com/better-auth/better-auth/pull/11260
const isOlderThanEducator = async (
  context: AuthContext,
  token: unknown,
): Promise<boolean> => {
  const confirmation = await readConfirmationToken(token, context.secret)
  if (!confirmation) {
    return false
  }
  const existing = await context.internalAdapter.findUserByEmail(
    confirmation.email,
  )
  return (
    existing !== null &&
    confirmation.issuedAt < Math.floor(existing.user.createdAt.getTime() / 1000)
  )
}

// Returns nothing for a token that fails verification. The issue time is in
// seconds
const readConfirmationToken = async (
  token: unknown,
  secret: string,
): Promise<{ email: string; issuedAt: number } | undefined> => {
  if (typeof token !== `string`) {
    return undefined
  }
  const payload = await verifyJWT<{ email?: unknown; iat?: unknown }>(
    token,
    secret,
  )
  return typeof payload?.email === `string` && typeof payload.iat === `number`
    ? { email: payload.email, issuedAt: payload.iat }
    : undefined
}

const parseName = async (name: unknown): Promise<string> => {
  const parsed = await EDUCATOR_NAME_SCHEMA.safeParseAsync(name)
  if (!parsed.success) {
    throw new APIError(`BAD_REQUEST`, {
      message: parsed.error.issues[0]?.message,
    })
  }
  return parsed.data
}

// An unconfirmed educator belongs to no one yet, so a new sign-up starts over
// with its own name and password. Otherwise the new link would confirm the
// password of whoever signed up first, who may not own the address. Remove
// once Better Auth ships https://github.com/better-auth/better-auth/pull/11260
const deleteUnconfirmedEducator = async (
  internalAdapter: AuthContext[`internalAdapter`],
  email: string,
): Promise<void> => {
  const existing = await internalAdapter.findUserByEmail(email)
  if (existing && !existing.user.emailVerified) {
    await internalAdapter.deleteUser(existing.user.id)
  }
}

// Refunds the attempts of a request that made a session. Notifies the owner
// however the password or a passkey changed, so a stolen session can't change
// either quietly
const afterAuthRequest = createAuthMiddleware(async ctx => {
  if (ctx.context.returned instanceof APIError) {
    return
  }
  // Only a request that made a session succeeded, whatever the response says
  if (ctx.context.newSession) {
    await refundAuthRequest({
      path: ctx.path,
      email: (ctx.body as Record<string, unknown> | undefined)?.email,
      headers: ctx.headers,
    })
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
  if (ctx.path === `/passkey/delete-passkey`) {
    notifySecondFactorChanged(educator.email, `passkey-removed`)
  }
})

// The session that adds a passkey counts as having used it, so setting up the
// first one opens the admin area without signing in again. Better Auth makes a
// new session when an authenticator app turns on, which the session hook
// marks
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
  void sendNoticeOrLog(
    secondFactorChangedEmail({ to, change, settingsUrl: SETTINGS_URL.href }),
  )
}

// Better Auth updates `twoFactorEnabled` only when an authenticator app turns
// on or off
const AUTHENTICATOR_APP_CHANGES: Record<string, SecondFactorChange> = {
  '/two-factor/verify-totp': `authenticator-app-added`,
  '/two-factor/disable': `authenticator-app-removed`,
}

const BASE_ORIGIN = new URL(BASE_URL)

// Doesn't wait for the email, which can't undo the change
const notifyPasswordChanged = (to: string): void => {
  void sendNoticeOrLog(
    passwordChangedEmail({ to, resetUrl: FORGOT_PASSWORD_URL.href }),
  )
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
    // Only confirmed educators reach this, since sign-up deletes unconfirmed
    // ones first
    onExistingUserSignUp: async ({ user }) => {
      await sendEmail(
        alreadySignedUpEmail({
          to: user.email,
          signInUrl: SIGN_IN_URL.href,
          resetUrl: FORGOT_PASSWORD_URL.href,
        }),
      )
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
    sendVerificationEmail: ({ user, url }) =>
      sendEmail(confirmEmail({ to: user.email, url })),
  },
  session: {
    fields: { userId: `educatorId` },
    // No default, so a session Better Auth makes in place of another keeps
    // its assurance. The database defaults a new one to PASSWORD
    additionalFields: {
      assurance: {
        type: Object.values(SessionAssurance),
        required: false,
        input: false,
      },
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
        // Nothing stores IP addresses
        before: (session, ctx) =>
          Promise.resolve({
            data: {
              ...session,
              ipAddress: null,
              ...(ctx && SECOND_FACTOR_SIGN_IN_PATHS.has(ctx.path)
                ? { assurance: `SECOND_FACTOR` }
                : {}),
            },
          }),
      },
    },
    user: {
      update: {
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
    throw new APIError(`BAD_REQUEST`, {
      message: `Use a passkey that checks your fingerprint, face, or PIN`,
    })
  }
}

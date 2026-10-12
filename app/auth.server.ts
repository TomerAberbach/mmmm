import { betterAuth } from 'better-auth'
import type { AuthContext } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { verifyJWT } from 'better-auth/crypto'
import {
  CONFIRMATION_EXPIRES_IN_DAYS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  RESET_EXPIRES_IN_HOURS,
} from './auth-forms.ts'
import { prisma } from './db.server.ts'
import { sendEmail, sendEmailOrLog } from './email.server.ts'
import { alreadySignedUpEmail } from './emails/already-signed-up.server.tsx'
import { confirmEmail } from './emails/confirm-email.server.tsx'
import { passwordChangedEmail } from './emails/password-changed.server.tsx'
import { resetPasswordEmail } from './emails/reset-password.server.tsx'
import { requireEnv } from './env.server.ts'
import { serverFreeTextSchema } from './free-text.server.ts'
import { EDUCATOR_NAME } from './free-text.ts'

const BASE_URL = requireEnv(`BETTER_AUTH_URL`)
const CONFIRMATION_EXPIRES_IN_SECONDS =
  CONFIRMATION_EXPIRES_IN_DAYS * 24 * 60 * 60

const SIGN_IN_URL = new URL(`/sign-in`, BASE_URL)
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
  let body = ctx.body as Record<string, unknown> | undefined
  if (!body) {
    return
  }
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

// Notifies the owner however the password changed, so a stolen session can't
// change it quietly
const afterAuthRequest = createAuthMiddleware(ctx => {
  const educator = ctx.context.session?.user
  if (
    ctx.path !== `/change-password` ||
    ctx.context.returned instanceof APIError ||
    !educator
  ) {
    return Promise.resolve()
  }
  notifyPasswordChanged(educator.email)
  return Promise.resolve()
})

// Doesn't wait for the email, which can't undo the change
const notifyPasswordChanged = (to: string): void => {
  void sendEmailOrLog(
    passwordChangedEmail({ to, resetUrl: FORGOT_PASSWORD_URL.href }),
  )
}

export const auth = betterAuth({
  baseURL: BASE_URL,
  secret: requireEnv(`BETTER_AUTH_SECRET`),
  database: prismaAdapter(prisma, { provider: `postgresql` }),
  user: { modelName: `educator` },
  session: { fields: { userId: `educatorId` } },
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
    sendOnSignIn: true,
    // Off because whoever set the password may not own the address. A
    // confirmed educator still signs in with the password
    autoSignInAfterVerification: false,
    expiresIn: CONFIRMATION_EXPIRES_IN_SECONDS,
    sendVerificationEmail: ({ user, url }) =>
      sendEmail(confirmEmail({ to: user.email, url })),
  },
  // Off because its limit of 3 sign-ins per 10 seconds per IP address would
  // block a school that shares one address
  rateLimit: { enabled: false },
  databaseHooks: {
    // Nothing stores IP addresses
    session: {
      create: {
        before: session =>
          Promise.resolve({ data: { ...session, ipAddress: null } }),
      },
    },
  },
})

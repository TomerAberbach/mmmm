import { randomUUID } from 'node:crypto'
import { getAuthenticatorName } from '@better-auth/passkey'
import type { GenericEndpointContext } from 'better-auth'
import { getSessionFromCtx } from 'better-auth/api'
import { isAdmin } from './admins.server.ts'
import { refuse } from './app-refusal.server.ts'
import { prisma } from './db.server.ts'
import { sendNoticeOrLog } from './email.server.ts'
import { secondFactorChangedEmail } from './emails/second-factor-changed.server.tsx'
import type { Prisma } from './generated/prisma/client.ts'
import type { SessionAssurance } from './generated/prisma/enums.ts'
import {
  SECOND_FACTOR_EXPIRES_IN_HOURS,
  SETUP_LINK_EXPIRES_IN_HOURS,
} from './second-factor.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

/** Sessions these paths create used a second factor */
export const SECOND_FACTOR_SIGN_IN_PATHS = new Set([
  `/two-factor/verify-totp`,
  `/two-factor/verify-backup-code`,
  `/passkey/verify-authentication`,
])

const ADDING_PATHS = new Set([
  `/two-factor/enable`,
  `/two-factor/get-totp-uri`,
  `/two-factor/verify-totp`,
  `/passkey/generate-register-options`,
  `/passkey/verify-registration`,
])

const PASSKEY_SIGN_IN_PATHS = new Set([
  `/passkey/generate-authenticate-options`,
  `/passkey/verify-authentication`,
])

/**
 * Refuses a change to an educator's second factors unless their session used
 * one, so a stolen password alone can't add or remove one. A session that a
 * setup link proved may add the first. Only admins add second factors. Better
 * Auth's two-factor paths without a session are the sign-in challenge, which
 * this leaves alone
 */
export const guardSecondFactorChange = async (
  ctx: GenericEndpointContext,
): Promise<void> => {
  if (!changesSecondFactors(ctx.path)) {
    return
  }
  if (ctx.path === `/passkey/delete-passkey`) {
    throw new Error(`Remove a passkey with removePasskey, which keeps the last`)
  }
  const signedIn = await getSessionFromCtx(ctx)
  if (!signedIn) {
    return
  }
  const { user: educator, session } = signedIn
  const secondFactors = await readSecondFactors(educator.id)
  requireMayChange(readAssurance(session), secondFactors)
  if (ADDING_PATHS.has(ctx.path) && !isAdmin(educator)) {
    throw refuse(`FORBIDDEN`, `Only admins add second factors`)
  }
}

const requireMayChange = (
  assurance: SessionAssurance,
  secondFactors: SecondFactors,
): void => {
  if (!mayChangeSecondFactors(assurance, secondFactors)) {
    throw refuse(`FORBIDDEN`, `Use your second factor before changing it`)
  }
}

/**
 * Removes one of the educator's passkeys, and emails them about it. Resolves
 * to whether they had it
 */
export const removePasskey = async (
  passkeyId: string,
  educatorId: string,
  assurance: SessionAssurance,
): Promise<boolean> => {
  const email = await prisma.$transaction(async tx => {
    const { educator, secondFactors } = await lockSecondFactors(educatorId, tx)
    requireMayChange(assurance, secondFactors)
    if (!secondFactors.passkeys.some(({ id }) => id === passkeyId)) {
      return null
    }
    keepLastSecondFactor(educator, secondFactors)
    await tx.passkey.delete({ where: { id: passkeyId } })
    return educator.email
  })
  if (email === null) {
    return false
  }
  // Doesn't wait for the email, which can't undo the change
  void sendNoticeOrLog(
    secondFactorChangedEmail({ to: email, change: `passkey-removed` }),
  )
  return true
}

/**
 * Stops counting the authenticator app as one of the educator's second factors,
 * before Better Auth deletes it
 */
export const releaseAuthenticatorApp = (educatorId: string): Promise<void> =>
  prisma.$transaction(async tx => {
    const { educator, secondFactors } = await lockSecondFactors(educatorId, tx)
    if (secondFactors.hasAuthenticatorApp) {
      keepLastSecondFactor(educator, secondFactors)
      await tx.educator.update({
        where: { id: educatorId },
        data: { twoFactorEnabled: false },
      })
    }
  })

/**
 * Deletes the row of an authenticator app that's off, such as one left when
 * turning it off failed partway, which Better Auth refuses to set up again.
 * Resolves to whether the app was off
 */
export const deleteTurnedOffApp = (educatorId: string): Promise<boolean> =>
  prisma.$transaction(async tx => {
    const { secondFactors } = await lockSecondFactors(educatorId, tx)
    if (secondFactors.hasAuthenticatorApp) {
      return false
    }
    await tx.authenticatorApp.deleteMany({ where: { educatorId } })
    return true
  })

/** Two removals at once would otherwise each count the other's second factor */
const lockSecondFactors = async (
  educatorId: string,
  tx: Prisma.TransactionClient,
) => {
  await tx.$queryRaw`
    SELECT 1 FROM "Educator" WHERE "id" = ${educatorId} FOR NO KEY UPDATE
  `
  const educator = await tx.educator.findUniqueOrThrow({
    where: { id: educatorId },
    select: { email: true, emailVerified: true },
  })
  return { educator, secondFactors: await readSecondFactors(educatorId, tx) }
}

export const LAST_SECOND_FACTOR_MESSAGE = `Admins keep at least one second factor. Add another before removing this one`

const keepLastSecondFactor = (
  educator: Parameters<typeof isAdmin>[0],
  secondFactors: SecondFactors,
): void => {
  if (isAdmin(educator) && countSecondFactors(secondFactors) <= 1) {
    throw refuse(`BAD_REQUEST`, LAST_SECOND_FACTOR_MESSAGE)
  }
}

/** What a session proved, and when */
export type SessionProof = {
  /**
   * Without a required field, TypeScript refuses Better Auth's session type,
   * which lacks `assurance`
   */
  id: string
  assurance?: SessionAssurance | null
  secondFactorUsedAt?: Date | null
}

/**
 * A session Better Auth just created can lack `assurance`, which the database
 * defaults to PASSWORD. A session that used its second factor too long ago counts
 * as having used only a password
 */
export const readAssurance = (session: SessionProof): SessionAssurance =>
  session.assurance === `SECOND_FACTOR` && !isFresh(session.secondFactorUsedAt)
    ? `PASSWORD`
    : (session.assurance ?? `PASSWORD`)

const isFresh = (usedAt: Date | null | undefined): boolean =>
  usedAt !== null && usedAt !== undefined && usedAt > readFreshCutoff()

/** A second factor used by then must be used again */
const readFreshCutoff = (): Date =>
  new Date(Date.now() - SECOND_FACTOR_EXPIRES_IN_HOURS * 60 * 60 * 1000)

const changesSecondFactors = (path: string): boolean =>
  path.startsWith(`/two-factor/`) ||
  (path.startsWith(`/passkey/`) && !PASSKEY_SIGN_IN_PATHS.has(path))

export const mayChangeSecondFactors = (
  assurance: SessionAssurance,
  secondFactors: SecondFactors,
): boolean =>
  assurance === `SECOND_FACTOR` ||
  (assurance === `SETUP_LINK` && !hasSecondFactor(secondFactors))

/**
 * Deleting an account deletes its second factors, so it needs one the same as
 * removing them does. Otherwise whoever reads an admin's email could reset the
 * password, delete the account, and sign up again
 */
export const mayDeleteAccount = (
  assurance: SessionAssurance,
  secondFactors: SecondFactors,
): boolean => assurance === `SECOND_FACTOR` || !hasSecondFactor(secondFactors)

export type SecondFactors = {
  /**
   * Each passkey's provider, such as iCloud Keychain, when its authenticator
   * reports one
   */
  passkeys: { id: string; provider: string | undefined; addedAt: Date }[]
  /** Better Auth turns this on once the educator enters a first code */
  hasAuthenticatorApp: boolean
}

export const readSecondFactors = async (
  educatorId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<SecondFactors> => {
  const educator = await db.educator.findUniqueOrThrow({
    where: { id: educatorId },
    select: {
      twoFactorEnabled: true,
      passkeys: {
        select: { id: true, aaguid: true, createdAt: true },
        orderBy: { createdAt: `asc` },
      },
    },
  })
  return {
    passkeys: educator.passkeys.map(({ id, aaguid, createdAt }) => ({
      id,
      provider: getAuthenticatorName(aaguid),
      addedAt: createdAt,
    })),
    hasAuthenticatorApp: educator.twoFactorEnabled,
  }
}

const countSecondFactors = ({
  passkeys,
  hasAuthenticatorApp,
}: SecondFactors): number => passkeys.length + (hasAuthenticatorApp ? 1 : 0)

export const hasSecondFactor = (secondFactors: SecondFactors): boolean =>
  countSecondFactors(secondFactors) > 0

const SETUP_LINK_PREFIX = `second-factor-setup:`

export const createSetupLinkToken = (): string => createSecret()

/**
 * Makes the token's link work, in place of the educator's earlier ones. Stores
 * only the token's hash, so reading the database reveals no working link. Call
 * it once the link is sent, so an unsent one leaves the earlier one working
 */
export const storeSetupLinkToken = async (
  educatorId: string,
  token: string,
): Promise<void> => {
  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: {
        identifier: { startsWith: SETUP_LINK_PREFIX },
        value: educatorId,
      },
    }),
    prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: setupLinkIdentifier(token),
        value: educatorId,
        expiresAt: new Date(
          Date.now() + SETUP_LINK_EXPIRES_IN_HOURS * 60 * 60 * 1000,
        ),
      },
    }),
  ])
}

/**
 * Uses up the token, so its link works once, and only for its own educator.
 * The link proves the session's educator reads their email. A session that
 * used a second factor lately keeps that
 */
export const redeemSetupLink = (
  token: string,
  educatorId: string,
  sessionId: string,
): Promise<boolean> =>
  prisma.$transaction(async tx => {
    const { count } = await tx.verification.deleteMany({
      where: {
        identifier: setupLinkIdentifier(token),
        value: educatorId,
        expiresAt: { gt: new Date() },
      },
    })
    if (count === 0) {
      return false
    }
    await tx.session.updateMany({
      where: {
        id: sessionId,
        OR: [
          { assurance: `PASSWORD` },
          {
            assurance: `SECOND_FACTOR`,
            secondFactorUsedAt: { lte: readFreshCutoff() },
          },
        ],
      },
      data: { assurance: `SETUP_LINK` },
    })
    return true
  })

const setupLinkIdentifier = (token: string): string =>
  `${SETUP_LINK_PREFIX}${hashSecret(token)}`

/**
 * Using a second factor, here or by adding one, opens the admin area for the
 * session
 */
export const markSecondFactorUsed = async (
  sessionId: string,
): Promise<void> => {
  await prisma.session.update({
    where: { id: sessionId },
    data: { assurance: `SECOND_FACTOR`, secondFactorUsedAt: new Date() },
  })
}

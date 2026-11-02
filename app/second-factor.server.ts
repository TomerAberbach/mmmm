import { randomUUID } from 'node:crypto'
import { getAuthenticatorName } from '@better-auth/passkey'
import type { GenericEndpointContext } from 'better-auth'
import { APIError, getSessionFromCtx } from 'better-auth/api'
import { isAdmin } from './admins.server.ts'
import { prisma } from './db.server.ts'
import type { SessionAssurance } from './generated/prisma/enums.ts'
import {
  LAST_SECOND_FACTOR,
  SECOND_FACTOR_REQUIRED,
  SETUP_LINK_EXPIRES_IN_HOURS,
} from './second-factor.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

// Sessions these paths create used a second factor
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

const REMOVING_PATHS = new Set([
  `/passkey/delete-passkey`,
  `/two-factor/disable`,
])

const PASSKEY_SIGN_IN_PATHS = new Set([
  `/passkey/generate-authenticate-options`,
  `/passkey/verify-authentication`,
])

// Refuses a change to an educator's second factors unless their session used
// one, so a stolen password alone can't add or remove one. A session that a
// setup link proved may add the first. Only admins add second factors, and an
// admin keeps at least one. Better Auth's two-factor paths without a session
// are the sign-in challenge, which this leaves alone
export const guardSecondFactorChange = async (
  ctx: GenericEndpointContext,
): Promise<void> => {
  if (!changesSecondFactors(ctx.path)) {
    return
  }
  const signedIn = await getSessionFromCtx(ctx)
  if (!signedIn) {
    return
  }
  const { user: educator, session } = signedIn
  const secondFactors = await readSecondFactors(educator.id)
  // Better Auth types its sessions without the app's fields
  const assurance = session.assurance as SessionAssurance | null | undefined
  if (!mayChangeSecondFactors(assurance ?? `PASSWORD`, secondFactors)) {
    throw new APIError(`FORBIDDEN`, {
      code: SECOND_FACTOR_REQUIRED,
      message: `Use your second factor before changing it`,
    })
  }
  if (ADDING_PATHS.has(ctx.path) && !isAdmin(educator)) {
    throw new APIError(`FORBIDDEN`, {
      code: SECOND_FACTOR_REQUIRED,
      message: `Only admins add second secondFactors`,
    })
  }
  if (
    REMOVING_PATHS.has(ctx.path) &&
    isAdmin(educator) &&
    countSecondFactors(secondFactors) <= 1
  ) {
    throw new APIError(`BAD_REQUEST`, {
      code: LAST_SECOND_FACTOR,
      message: `Admins keep at least one second factor. Add another before removing this one.`,
    })
  }
}

const changesSecondFactors = (path: string): boolean =>
  path.startsWith(`/two-factor/`) ||
  (path.startsWith(`/passkey/`) && !PASSKEY_SIGN_IN_PATHS.has(path))

export const mayChangeSecondFactors = (
  assurance: SessionAssurance,
  secondFactors: SecondFactors,
): boolean =>
  assurance === `SECOND_FACTOR` ||
  (assurance === `SETUP_LINK` && !hasSecondFactor(secondFactors))

export type SecondFactors = {
  // Each passkey's provider, such as iCloud Keychain, when its authenticator
  // reports one
  passkeys: { id: string; provider: string | undefined; addedAt: Date }[]
  // Better Auth turns this on once the educator enters a first code
  hasAuthenticatorApp: boolean
}

export const readSecondFactors = async (
  educatorId: string,
): Promise<SecondFactors> => {
  const educator = await prisma.educator.findUniqueOrThrow({
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

// Stores only the token's hash, so reading the database reveals no working
// link. A new link replaces the educator's earlier ones
export const createSetupLinkToken = async (
  educatorId: string,
): Promise<string> => {
  const token = createSecret()
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
  return token
}

// Uses up the token, so its link works once, and only for its own educator
export const redeemSetupLinkToken = async (
  token: string,
  educatorId: string,
): Promise<boolean> => {
  const { count } = await prisma.verification.deleteMany({
    where: {
      identifier: setupLinkIdentifier(token),
      value: educatorId,
      expiresAt: { gt: new Date() },
    },
  })
  return count > 0
}

const setupLinkIdentifier = (token: string): string =>
  `${SETUP_LINK_PREFIX}${hashSecret(token)}`

// Using a second factor, here or by adding one, opens the admin area for the
// session
export const markSecondFactorUsed = async (
  sessionId: string,
): Promise<void> => {
  await prisma.session.update({
    where: { id: sessionId },
    data: { assurance: `SECOND_FACTOR` },
  })
}

// A setup link proves the session's educator reads their email. A session
// that already used a second factor keeps that
export const markSetupLinkUsed = async (sessionId: string): Promise<void> => {
  await prisma.session.updateMany({
    where: { id: sessionId, assurance: `PASSWORD` },
    data: { assurance: `SETUP_LINK` },
  })
}

// Where an admin's session goes when it hasn't used a second factor: setup
// without one, or verifying one they have
export const readSecondFactorStep = (
  secondFactors: SecondFactors,
): `/admin/setup` | `/admin/verify` =>
  hasSecondFactor(secondFactors) ? `/admin/verify` : `/admin/setup`

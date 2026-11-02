import { isAdmin } from './admins.server.ts'
import { auth } from './auth.server.ts'
import { formatArizonaDate } from './dates.ts'
import {
  hasSecondFactor,
  mayChangeSecondFactors,
  readSecondFactors,
} from './second-factor.server.ts'
import type { SignedInEducator, SignedInSession } from './session.server.ts'

export type SecondFactorSettingsData = {
  isAdmin: boolean
  // Whether this session used a second factor, or a setup link before the
  // first one, so the server allows changes
  canChange: boolean
  passkeys: { id: string; label: string; added: string }[]
  // Set while the authenticator app is on
  recoveryCodesLeft?: number
}

// Only admins, and former admins who still have a second factor, see the
// section
export const readSecondFactorSettings = async (
  educator: SignedInEducator,
  session: SignedInSession,
  headers: Headers,
): Promise<SecondFactorSettingsData | undefined> => {
  const secondFactors = await readSecondFactors(educator.id)
  const admin = isAdmin(educator)
  if (!admin && !hasSecondFactor(secondFactors)) {
    return undefined
  }
  return {
    isAdmin: admin,
    canChange: mayChangeSecondFactors(session.assurance, secondFactors),
    passkeys: secondFactors.passkeys.map(({ id, provider, addedAt }) => ({
      id,
      label: provider ?? `Passkey`,
      // The month and day are enough to recognize a passkey. Formatting here
      // keeps the server's and the browser's text the same
      added: formatArizonaDate(addedAt),
    })),
    recoveryCodesLeft: secondFactors.hasAuthenticatorApp
      ? await countRecoveryCodes(educator.id, headers)
      : undefined,
  }
}

// Better Auth drops each code once it's used
const countRecoveryCodes = async (
  educatorId: string,
  headers: Headers,
): Promise<number> => {
  const { backupCodes } = await auth.api.viewBackupCodes({
    body: { userId: educatorId },
    headers,
  })
  return backupCodes.length
}

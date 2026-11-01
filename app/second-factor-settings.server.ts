import { isAdmin } from './admins.server.ts'
import { auth } from './auth.server.ts'
import type { SecondFactorSettingsData } from './components/second-factor-settings.tsx'
import { formatDate } from './dates.ts'
import {
  hasSecondFactor,
  mayChangeSecondFactors,
  readSecondFactors,
} from './second-factor.server.ts'
import type { SignedInEducator, SignedInSession } from './session.server.ts'

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
      added: formatDate(addedAt),
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

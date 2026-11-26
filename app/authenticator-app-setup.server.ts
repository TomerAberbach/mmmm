import { symmetricDecrypt } from 'better-auth/crypto'
import { auth } from './auth.server.ts'
import { prisma } from './db.server.ts'

/**
 * Whether the URI still holds the educator's secret. Starting setup again
 * replaces it, so no code from the earlier QR code matches
 */
export const isCurrentSetup = async (
  educatorId: string,
  totpUri: string,
): Promise<boolean> => {
  const app = await prisma.authenticatorApp.findFirst({
    where: { educatorId },
    select: { secret: true },
  })
  if (!app) {
    return false
  }
  const { secretConfig } = await auth.$context
  const secret = await symmetricDecrypt({ key: secretConfig, data: app.secret })
  return new URL(totpUri).searchParams.get(`secret`) === toBase32(secret)
}

/**
 * Whether the educator has an authenticator app that no code has turned on
 * since its setup started
 */
export const isUnfinishedSetup = async (educatorId: string): Promise<boolean> =>
  (await prisma.authenticatorApp.count({
    where: { educatorId, verified: false },
  })) > 0

const BASE32_ALPHABET = `ABCDEFGHIJKLMNOPQRSTUVWXYZ234567`

/** Without padding, as an otpauth:// URI writes it */
const toBase32 = (text: string): string => {
  const bits = [...Buffer.from(text)]
    .map(byte => byte.toString(2).padStart(8, `0`))
    .join(``)
  return (bits.match(/.{1,5}/gu) ?? [])
    .map(group => BASE32_ALPHABET[Number.parseInt(group.padEnd(5, `0`), 2)])
    .join(``)
}

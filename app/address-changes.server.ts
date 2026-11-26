import { randomUUID } from 'node:crypto'
import { href } from 'react-router'
import { z } from 'zod'
import { CONFIRMATION_EXPIRES_IN_DAYS } from './auth-forms.ts'
import { prisma } from './db.server.ts'
import { freeAddress, isAddressFree } from './educator-deletion.server.ts'
import { sendEmail, sendNoticeOrLog } from './email.server.ts'
import { addressChangedEmail } from './emails/address-changed.server.tsx'
import { confirmAddressEmail } from './emails/confirm-address.server.tsx'
import { toAppUrl } from './env.server.ts'
import { normalizeEmail } from './limits.server.ts'
import { joinOrganization } from './organizations.server.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

export type AddressRefusal = `NO_EDUCATOR` | `TAKEN` | `EMAIL_LIMIT`

/**
 * Emails the new address a link that changes the educator's address to it. The
 * educator keeps the old address, confirmed, until they use the link. A new
 * request turns off earlier links. Resolves to null once sent
 */
export const requestAddressChange = async (
  educatorId: string,
  address: string,
): Promise<AddressRefusal | null> => {
  const email = normalizeEmail(address)
  const educator = await prisma.educator.findUnique({
    where: { id: educatorId, emailVerified: true },
    select: { id: true },
  })
  if (!educator) {
    return `NO_EDUCATOR`
  }
  if (!(await isAddressFree(email))) {
    return `TAKEN`
  }
  // An earlier request's address may have been a mistake
  await prisma.verification.deleteMany({
    where: {
      identifier: { startsWith: IDENTIFIER_PREFIX },
      value: { contains: educatorId },
    },
  })
  const secret = createSecret()
  await prisma.verification.create({
    data: {
      id: randomUUID(),
      identifier: toIdentifier(secret),
      value: JSON.stringify({ educatorId, email }),
      expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
    },
  })
  const url = toAppUrl(href(`/confirm-address/:secret`, { secret })).href
  return (await sendEmail(confirmAddressEmail({ to: email, url })))
    ? null
    : `EMAIL_LIMIT`
}

const EXPIRES_IN_MS = CONFIRMATION_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000

const IDENTIFIER_PREFIX = `address-change:`

const toIdentifier = (secret: string): string =>
  `${IDENTIFIER_PREFIX}${hashSecret(secret)}`

const changeSchema = z.object({ educatorId: z.string(), email: z.string() })

const parseChange = (value: string): z.infer<typeof changeSchema> =>
  changeSchema.parse(JSON.parse(value))

/** The new address. Null for a link that expired, was used, or never worked */
export const readAddressChange = async (
  secret: string,
): Promise<string | null> => {
  const verification = await prisma.verification.findFirst({
    where: { identifier: toIdentifier(secret), expiresAt: { gt: new Date() } },
    select: { value: true },
  })
  return verification && parseChange(verification.value).email
}

/**
 * Changes the educator's address, signs them out everywhere, and moves them to
 * the new address's organization. Returns whether the link still worked and the
 * address is free
 */
export const confirmAddressChange = async (
  secret: string,
): Promise<boolean> => {
  const changed = await prisma.$transaction(async tx => {
    // Deleting it first lets only one request use the link
    const [verification] = await tx.$queryRaw<{ value: string }[]>`
      DELETE FROM "Verification"
      WHERE "identifier" = ${toIdentifier(secret)} AND "expiresAt" > ${new Date()}
      RETURNING "value"
    `
    if (!verification) {
      return null
    }
    const { educatorId, email } = parseChange(verification.value)
    const educator = await tx.educator.findUnique({
      where: { id: educatorId, emailVerified: true },
      select: { email: true },
    })
    if (!educator || !(await freeAddress(email, tx))) {
      return null
    }
    await tx.educator.update({ where: { id: educatorId }, data: { email } })
    await tx.session.deleteMany({ where: { educatorId } })
    // Reset links and address changes already sent
    await tx.verification.deleteMany({
      where: {
        value: { contains: educatorId },
      },
    })
    return { educatorId, oldEmail: educator.email }
  })
  if (!changed) {
    return false
  }
  // First, so a failure to join can't hide the change from the old address
  await sendNoticeOrLog(addressChangedEmail({ to: changed.oldEmail }))
  await joinOrganization(changed.educatorId)
  return true
}

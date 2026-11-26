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
import { Prisma } from './generated/prisma/client.ts'
import { normalizeEmail } from './limits.server.ts'
import { joinOrganization } from './organizations.server.ts'
import { createSecret, hashSecret } from './secrets.server.ts'

/** `TAKEN` when the address gained an account after the link was sent */
export type AddressConfirmation = `CHANGED` | `INVALID` | `TAKEN`

export type AddressRefusal = `NO_EDUCATOR` | `TAKEN` | `EMAIL_LIMIT`

/**
 * Emails the new address a link that changes the educator's address to it. The
 * educator keeps the old address, confirmed, until they use the link. A new
 * link turns off earlier ones once it's sent, so an unsent one leaves them
 * working. Resolves to null once sent
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
  const secret = createSecret()
  const earlier = await prisma.verification.findMany({
    where: {
      identifier: { startsWith: IDENTIFIER_PREFIX },
      value: { contains: educatorId },
    },
    select: { id: true },
  })
  // Stored before it's sent, so the link works once it arrives
  const id = randomUUID()
  await prisma.verification.create({
    data: {
      id,
      identifier: toIdentifier(secret),
      value: JSON.stringify({ educatorId, email }),
      expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
    },
  })
  const url = toAppUrl(href(`/confirm-address/:secret`, { secret })).href
  const isSent = await sendEmail(confirmAddressEmail({ to: email, url }))
  // An earlier request's address may have been a mistake
  const unwanted = isSent ? earlier : [{ id }]
  await prisma.verification.deleteMany({
    where: { id: { in: unwanted.map(link => link.id) } },
  })
  return isSent ? null : `EMAIL_LIMIT`
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
 * the new address's organization
 */
export const confirmAddressChange = async (
  secret: string,
): Promise<AddressConfirmation> => {
  const changed = await changeAddress(secret)
  if (typeof changed === `string`) {
    return changed
  }
  await sendNoticeOrLog(addressChangedEmail({ to: changed.oldEmail }))
  try {
    await joinOrganization(changed.educatorId)
  } catch (error) {
    // The address has changed, and the next sign-in joins again
    console.error(`Joining an organization failed`, error)
  }
  return `CHANGED`
}

type AddressChange = { educatorId: string; oldEmail: string }

type AddressChangeFailure = Exclude<AddressConfirmation, `CHANGED`>

/** Another request may take the address or delete the educator meanwhile */
const changeAddress = async (
  secret: string,
): Promise<AddressChange | AddressChangeFailure> => {
  try {
    return await prisma.$transaction(tx => spendLink(secret, tx))
  } catch (error) {
    const failure =
      error instanceof Prisma.PrismaClientKnownRequestError
        ? LOST_RACES[error.code]
        : undefined
    if (failure) {
      return failure
    }
    throw error
  }
}

/** The address now has another educator, or the educator is gone */
const LOST_RACES: Record<string, AddressChangeFailure> = {
  P2002: `TAKEN`,
  P2025: `INVALID`,
}

const spendLink = async (
  secret: string,
  tx: Prisma.TransactionClient,
): Promise<AddressChange | AddressChangeFailure> => {
  // Deleting it first lets only one request use the link
  const [verification] = await tx.$queryRaw<{ value: string }[]>`
      DELETE FROM "Verification"
      WHERE "identifier" = ${toIdentifier(secret)} AND "expiresAt" > ${new Date()}
      RETURNING "value"
    `
  if (!verification) {
    return `INVALID`
  }
  const { educatorId, email } = parseChange(verification.value)
  const educator = await tx.educator.findUnique({
    where: { id: educatorId, emailVerified: true },
    select: { email: true },
  })
  if (!educator) {
    return `INVALID`
  }
  if (!(await freeAddress(email, tx))) {
    return `TAKEN`
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
}

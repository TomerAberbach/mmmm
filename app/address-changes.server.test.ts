import { randomUUID } from 'node:crypto'
import { expect, test, vi } from 'vitest'
import { createEducator, createMember } from '../test/educators.ts'
import {
  confirmAddressChange,
  readAddressChange,
  requestAddressChange,
} from './address-changes.server.ts'
import { prisma } from './db.server.ts'
import { sendEmail } from './email.server.ts'
import { passwordChangedEmail } from './emails/password-changed.server.tsx'
import { readMailbox } from './mailbox.server.ts'
import { readOrganization } from './organizations.server.ts'

/** The secret of the link emailed to the address */
const readSecret = (email: string): string => {
  const mail = readMailbox().find(({ to }) => to === email)
  return /confirm-address\/(?<secret>[\w-]+)/u.exec(mail!.html)!.groups!.secret!
}

const createEducatorWithAddress = async () => {
  const domain = `${randomUUID()}.edu`
  const id = await createMember(domain)
  return { id, email: `${id}@${domain}` }
}

const readEmail = async (id: string) =>
  (await prisma.educator.findUnique({ where: { id }, select: { email: true } }))
    ?.email

test(`the address changes only once the educator confirms it`, async () => {
  const { id, email } = await createEducatorWithAddress()
  const domain = `${randomUUID()}.edu`
  const newEmail = `new@${domain}`

  await expect(
    requestAddressChange(id, ` ${newEmail.toUpperCase()} `),
  ).resolves.toBeNull()
  const secret = readSecret(newEmail)
  await expect(readEmail(id)).resolves.toBe(email)
  await expect(readAddressChange(secret)).resolves.toBe(newEmail)

  await expect(confirmAddressChange(secret)).resolves.toBe(`CHANGED`)

  await expect(readEmail(id)).resolves.toBe(newEmail)
  await expect(readOrganization(id)).resolves.toMatchObject({ domain })
  expect(readMailbox().some(({ to }) => to === email)).toBe(true)
})

test(`a link works once`, async () => {
  const { id } = await createEducatorWithAddress()
  const newEmail = `new@${randomUUID()}.edu`
  await requestAddressChange(id, newEmail)
  const secret = readSecret(newEmail)
  await confirmAddressChange(secret)

  await expect(confirmAddressChange(secret)).resolves.toBe(`INVALID`)
  await expect(readAddressChange(secret)).resolves.toBeNull()
})

test(`confirming signs out and turns off earlier links`, async () => {
  const { id } = await createEducatorWithAddress()
  await prisma.session.create({
    data: {
      id: randomUUID(),
      token: randomUUID(),
      educatorId: id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  })
  await prisma.verification.create({
    data: {
      id: randomUUID(),
      identifier: `reset-password:token`,
      value: id,
      expiresAt: new Date(Date.now() + 60_000),
    },
  })
  const newEmail = `new@${randomUUID()}.edu`
  await requestAddressChange(id, newEmail)

  await confirmAddressChange(readSecret(newEmail))

  await expect(
    prisma.session.count({ where: { educatorId: id } }),
  ).resolves.toBe(0)
  await expect(
    prisma.verification.count({ where: { value: id } }),
  ).resolves.toBe(0)
})

test(`a new request turns off the earlier link`, async () => {
  const { id, email } = await createEducatorWithAddress()
  const wrongEmail = `wrong@${randomUUID()}.edu`
  await requestAddressChange(id, wrongEmail)
  await requestAddressChange(id, `new@${randomUUID()}.edu`)

  await expect(confirmAddressChange(readSecret(wrongEmail))).resolves.toBe(
    `INVALID`,
  )
  await expect(readEmail(id)).resolves.toBe(email)
})

test(`a new link over the hourly email limit leaves the earlier one working`, async () => {
  const { id } = await createEducatorWithAddress()
  const newEmail = `new@${randomUUID()}.edu`
  await requestAddressChange(id, newEmail)
  const secret = readSecret(newEmail)
  const fullEmail = `full@${randomUUID()}.edu`
  for (let sent = 0; sent < 10; sent++) {
    await sendEmail(passwordChangedEmail({ to: fullEmail }))
  }

  const refusal = await requestAddressChange(id, fullEmail)

  expect(refusal).toBe(`EMAIL_LIMIT`)
  await expect(
    prisma.verification.count({ where: { value: { contains: id } } }),
  ).resolves.toBe(1)
  await expect(readAddressChange(secret)).resolves.toBe(newEmail)
})

test(`a link that wasn't stored isn't sent`, async () => {
  const { id } = await createEducatorWithAddress()
  const newEmail = `new@${randomUUID()}.edu`
  vi.spyOn(prisma.verification, `create`).mockImplementationOnce(() => {
    throw new Error(`The database is down`)
  })

  await expect(requestAddressChange(id, newEmail)).rejects.toThrow(
    `The database is down`,
  )

  expect(readMailbox().some(({ to }) => to === newEmail)).toBe(false)
})

test(`an unconfirmed educator's address can't be changed`, async () => {
  await expect(
    requestAddressChange(await createEducator(), `new@${randomUUID()}.edu`),
  ).resolves.toBe(`NO_EDUCATOR`)
})

test(`another confirmed educator's address is refused`, async () => {
  const { id } = await createEducatorWithAddress()
  const other = await createEducatorWithAddress()

  await expect(requestAddressChange(id, other.email)).resolves.toBe(`TAKEN`)
})

test(`an address confirmed by another educator meanwhile stays theirs`, async () => {
  const { id, email } = await createEducatorWithAddress()
  const domain = `${randomUUID()}.edu`
  const otherId = await createEducator(`Other`, { domain })
  const newEmail = `${otherId}@${domain}`
  await requestAddressChange(id, newEmail)
  await prisma.educator.update({
    where: { id: otherId },
    data: { emailVerified: true },
  })

  await expect(confirmAddressChange(readSecret(newEmail))).resolves.toBe(
    `TAKEN`,
  )

  await expect(readEmail(id)).resolves.toBe(email)
})

test(`an unconfirmed sign-up with the address makes way`, async () => {
  const { id } = await createEducatorWithAddress()
  const domain = `${randomUUID()}.edu`
  const otherId = await createEducator(`Other`, { domain })
  const newEmail = `${otherId}@${domain}`
  await requestAddressChange(id, newEmail)

  await expect(confirmAddressChange(readSecret(newEmail))).resolves.toBe(
    `CHANGED`,
  )

  await expect(readEmail(id)).resolves.toBe(newEmail)
  await expect(readEmail(otherId)).resolves.toBeUndefined()
})

test(`an expired link changes nothing`, async () => {
  const { id, email } = await createEducatorWithAddress()
  const newEmail = `new@${randomUUID()}.edu`
  await requestAddressChange(id, newEmail)
  const secret = readSecret(newEmail)
  await prisma.verification.updateMany({
    where: { value: { contains: id } },
    data: { expiresAt: new Date(0) },
  })

  await expect(confirmAddressChange(secret)).resolves.toBe(`INVALID`)
  await expect(readEmail(id)).resolves.toBe(email)
})

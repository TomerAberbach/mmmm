import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { createEducator } from '../test/educators.ts'
import { prisma } from './db.server.ts'
import { deleteExpiredSignIns } from './expired-sign-ins.server.ts'

const NOW = new Date(`2027-03-14T00:00:00Z`)
const BEFORE = new Date(NOW.getTime() - 1)

/** A session and an emailed link that expire then, by their shared ID */
const addExpiring = async (educatorId: string, expiresAt: Date) => {
  const id = randomUUID()
  await prisma.session.create({
    data: { id, token: id, educatorId, expiresAt },
  })
  await prisma.verification.create({
    data: { id, identifier: id, value: educatorId, expiresAt },
  })
  return id
}

test(`only expired sessions and links are deleted`, async () => {
  const educatorId = await createEducator()
  const expiredId = await addExpiring(educatorId, BEFORE)
  const keptId = await addExpiring(educatorId, NOW)

  await deleteExpiredSignIns(NOW)

  const where = { id: { in: [expiredId, keptId] } }
  const select = { id: true }
  await expect(
    prisma.session.findMany({ where, select }),
  ).resolves.toStrictEqual([{ id: keptId }])
  await expect(
    prisma.verification.findMany({ where, select }),
  ).resolves.toStrictEqual([{ id: keptId }])
})

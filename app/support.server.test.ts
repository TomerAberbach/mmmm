import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { addSubmission } from '../test/contests.ts'
import { createEducator, createMember } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import { setSubmissionStatus } from './contest-players.server.ts'
import { prisma } from './db.server.ts'
import { deleteEducator } from './educator-deletion.server.ts'
import {
  countOrganizationData,
  deleteOrganization,
  findEducator,
  handOverContest,
} from './support.server.ts'

const createOrphanedContest = async () => {
  await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const educatorId = await createMember(domain)
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: playerId } = await addPlayer(contestId)
  await addSubmission(playerId, `PENDING`)
  await deleteEducator(educatorId, `${educatorId}@${domain}`)
  return { domain, contestId, playerId }
}

test(`an educator is found by their exact address`, async () => {
  const domain = `${randomUUID()}.edu`
  const id = await createMember(domain)

  await expect(
    findEducator(` ${id.toUpperCase()}@${domain} `),
  ).resolves.toMatchObject({
    id,
    isConfirmed: true,
    organizationName: domain,
    contestCount: 0,
  })
  await expect(findEducator(`@${domain}`)).resolves.toBeNull()
})

test(`a contest handed over works for its new educator`, async () => {
  const { contestId, playerId } = await createOrphanedContest()
  const newId = await createMember(`${randomUUID()}.edu`)

  await expect(handOverContest(contestId, newId)).resolves.toBe(true)

  await expect(
    setSubmissionStatus(newId, contestId, [playerId], `APPROVED`),
  ).resolves.toBe(1)
  await expect(
    prisma.contest.findUnique({
      where: { id: contestId },
      select: { orphanedFromDomain: true },
    }),
  ).resolves.toStrictEqual({ orphanedFromDomain: null })
})

test(`only an orphaned contest is handed over, to a confirmed educator`, async () => {
  const { contestId } = await createOrphanedContest()
  const unconfirmedId = await createEducator()
  const firstId = await createMember(`${randomUUID()}.edu`)
  const secondId = await createMember(`${randomUUID()}.edu`)

  await expect(handOverContest(contestId, unconfirmedId)).resolves.toBe(false)
  await handOverContest(contestId, firstId)
  await expect(handOverContest(contestId, secondId)).resolves.toBe(false)
})

test(`deleting an organization's data leaves every other organization's`, async () => {
  const { domain, contestId: orphanedId } = await createOrphanedContest()
  const educatorId = await createMember(domain)
  await createEducator(`Unconfirmed`, { domain })
  const contestId = await addContest(educatorId, `Period 5 Biology`)
  const otherDomain = `${randomUUID()}.edu`
  const otherId = await createMember(otherDomain)
  const otherContestId = await addContest(otherId, `Other`)
  await expect(countOrganizationData(domain)).resolves.toStrictEqual({
    educatorCount: 2,
    contestCount: 2,
    playerCount: 1,
  })

  await expect(deleteOrganization(domain, otherId)).resolves.toBe(`DELETED`)

  await expect(
    prisma.contest.findMany({
      where: { id: { in: [orphanedId, contestId, otherContestId] } },
      select: { id: true },
    }),
  ).resolves.toStrictEqual([{ id: otherContestId }])
  await expect(
    prisma.educator.findMany({
      where: { id: { in: [educatorId, otherId] } },
      select: { id: true },
    }),
  ).resolves.toStrictEqual([{ id: otherId }])
  await expect(prisma.organization.count({ where: { domain } })).resolves.toBe(
    0,
  )
  await expect(deleteOrganization(domain, otherId)).resolves.toBe(`GONE`)
})

test(`deleting an organization's data deletes the links emailed to its educators`, async () => {
  const [domain, otherDomain] = [`${randomUUID()}.edu`, `${randomUUID()}.edu`]
  const educatorId = await createMember(domain)
  const otherId = await createMember(otherDomain)
  for (const id of [educatorId, otherId]) {
    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: randomUUID(),
        value: id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
  }

  await deleteOrganization(domain, otherId)

  await expect(
    prisma.verification.count({ where: { value: educatorId } }),
  ).resolves.toBe(0)
  await expect(
    prisma.verification.count({ where: { value: otherId } }),
  ).resolves.toBe(1)
})

test(`an admin can't delete their own organization`, async () => {
  const domain = `${randomUUID()}.edu`
  const adminId = await createMember(domain)

  await expect(deleteOrganization(domain, adminId)).resolves.toBe(`OWN`)
  await expect(prisma.educator.count({ where: { id: adminId } })).resolves.toBe(
    1,
  )
})

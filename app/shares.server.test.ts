import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { addContest } from '../test/contests.ts'
import { createEducator, createMember } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import { prisma } from './db.server.ts'
import { joinOrganization } from './organizations.server.ts'
import {
  readColleagues,
  readSharedContest,
  readSharedContests,
  shareContest,
  stopSharing,
} from './shares.server.ts'
import { deleteContest } from './trash.server.ts'

const addMember = async (domain: string, name?: string) => {
  const id = await createMember(domain, name)
  return { id, email: `${id}@${domain}` }
}

/** A contest in a new year, and a colleague in its educator's organization */
const createColleagues = async () => {
  const year = await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const owner = await addMember(domain)
  const colleague = await addMember(domain, `Mr. Ruhle`)
  const contestId = await addContest(owner.id, `Period 2 Biology`)
  return { year, owner, colleague, contestId }
}

test(`a contest opens for the colleague it's shared with`, async () => {
  const { year, owner, colleague, contestId } = await createColleagues()

  const refusal = await shareContest(
    owner.id,
    contestId,
    ` ${colleague.email.toUpperCase()} `,
  )

  expect(refusal).toBeNull()
  const contest = {
    id: contestId,
    name: `Period 2 Biology`,
    year,
    educatorName: `Ms. Frizzle`,
  }
  await expect(
    readSharedContest(colleague.id, contestId),
  ).resolves.toStrictEqual(contest)
  await expect(readSharedContests(colleague.id, year)).resolves.toStrictEqual([
    contest,
  ])
  await expect(readColleagues(contestId)).resolves.toStrictEqual([
    { id: colleague.id, name: `Mr. Ruhle`, email: colleague.email },
  ])
})

test(`sharing again changes nothing`, async () => {
  const { owner, colleague, contestId } = await createColleagues()
  await shareContest(owner.id, contestId, colleague.email)

  const refusal = await shareContest(owner.id, contestId, colleague.email)

  expect(refusal).toBeNull()
  await expect(readColleagues(contestId)).resolves.toHaveLength(1)
})

test(`an educator can't share with their own address`, async () => {
  const { owner, contestId } = await createColleagues()

  await expect(shareContest(owner.id, contestId, owner.email)).resolves.toBe(
    `OWN_ADDRESS`,
  )
})

test(`an educator can't share outside their organization`, async () => {
  const { owner, contestId } = await createColleagues()
  const outsider = await addMember(`${randomUUID()}.edu`)

  await expect(shareContest(owner.id, contestId, outsider.email)).resolves.toBe(
    `NO_COLLEAGUE`,
  )
})

test(`an educator can't share with an unconfirmed address`, async () => {
  const { owner, contestId } = await createColleagues()
  const domain = owner.email.split(`@`)[1]!
  const id = await createEducator(`Unconfirmed`, { domain })

  await expect(
    shareContest(owner.id, contestId, `${id}@${domain}`),
  ).resolves.toBe(`NO_COLLEAGUE`)
})

test(`educators without an organization can't share with each other`, async () => {
  await addYear({ published: true })
  const owner = await addMember(`gmail.com`)
  const other = await addMember(`gmail.com`)
  const contestId = await addContest(owner.id, `Period 2 Biology`)

  await expect(shareContest(owner.id, contestId, other.email)).resolves.toBe(
    `NO_COLLEAGUE`,
  )
})

test(`only the educator who runs a contest shares it`, async () => {
  const { colleague, contestId } = await createColleagues()

  await expect(
    shareContest(colleague.id, contestId, colleague.email),
  ).resolves.toBe(`NO_CONTEST`)
})

test(`a contest closes for a colleague once sharing stops`, async () => {
  const { owner, colleague, contestId } = await createColleagues()
  await shareContest(owner.id, contestId, colleague.email)

  await expect(stopSharing(owner.id, contestId, colleague.id)).resolves.toBe(
    true,
  )

  await expect(readSharedContest(colleague.id, contestId)).resolves.toBeNull()
  await expect(stopSharing(owner.id, contestId, colleague.id)).resolves.toBe(
    false,
  )
})

test(`a colleague can't stop sharing for the educator who runs the contest`, async () => {
  const { owner, colleague, contestId } = await createColleagues()
  await shareContest(owner.id, contestId, colleague.email)

  await expect(
    stopSharing(colleague.id, contestId, colleague.id),
  ).resolves.toBe(false)
})

test.each([`owner`, `colleague`] as const)(
  `a share ends once its %s leaves the organization`,
  async leaver => {
    const colleagues = await createColleagues()
    const { year, owner, colleague, contestId } = colleagues
    await shareContest(owner.id, contestId, colleague.email)
    const { id } = colleagues[leaver]

    await prisma.educator.update({
      where: { id },
      data: { email: `${id}@${randomUUID()}.edu` },
    })
    await joinOrganization(id)

    await expect(readSharedContest(colleague.id, contestId)).resolves.toBeNull()
    await expect(readSharedContests(colleague.id, year)).resolves.toStrictEqual(
      [],
    )
    await expect(readColleagues(contestId)).resolves.toStrictEqual([])
  },
)

test(`a deleted contest closes for colleagues`, async () => {
  const { owner, colleague, contestId } = await createColleagues()
  await shareContest(owner.id, contestId, colleague.email)

  await deleteContest(owner.id, contestId)

  await expect(readSharedContest(colleague.id, contestId)).resolves.toBeNull()
})

test(`the contest page leaves out a share that no longer works`, async () => {
  const { owner, colleague, contestId } = await createColleagues()
  await shareContest(owner.id, contestId, colleague.email)

  // A share can be added while its colleague leaves the organization
  await prisma.educator.update({
    where: { id: colleague.id },
    data: { organizationDomain: null },
  })

  await expect(readColleagues(contestId)).resolves.toStrictEqual([])
})

import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import {
  addSubmission,
  createContestInNewYear,
  readEducatorId,
} from '../test/contests.ts'
import { createMember } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import {
  readAdminContest,
  readAdminContests,
  setContestHidden,
} from './admin-contests.server.ts'
import type { AdminContest } from './admin-contests.server.ts'
import { deleteContest } from './trash.server.ts'

test(`the admin's contests list hidden ones first`, async () => {
  const year = await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const educatorId = await createMember(domain)
  const shownId = await addContest(educatorId, `A`)
  const hiddenId = await addContest(educatorId, `B`)
  await addSubmission((await addPlayer(shownId)).id, `APPROVED`)
  await addSubmission((await addPlayer(shownId)).id, `PENDING`)
  await setContestHidden(hiddenId, true)

  const { contests } = await readAdminContests(1)

  const shared = {
    educatorName: `Ms. Frizzle`,
    organizationName: domain,
    year,
    isInTrash: false,
  }
  expect(contests.filter(contest => contest.year === year)).toStrictEqual([
    { ...shared, id: hiddenId, name: `B`, isHidden: true, approvedCount: 0 },
    { ...shared, id: shownId, name: `A`, isHidden: false, approvedCount: 1 },
  ])
})

test(`the admin's contests list newer years first`, async () => {
  const older = await createContestInNewYear()
  const newer = await createContestInNewYear()
  const created = new Set([older.contestId, newer.contestId])

  const { contests } = await readAdminContests(1)

  expect(
    contests.map(({ id }) => id).filter(id => created.has(id)),
  ).toStrictEqual([newer.contestId, older.contestId])
})

const readEveryAdminContest = async (): Promise<AdminContest[]> => {
  const { contests, page } = await readAdminContests(1)
  for (let number = 2; number <= page.count; number++) {
    contests.push(...(await readAdminContests(number)).contests)
  }
  return contests
}

test(`the admin's contests list those in the trash last`, async () => {
  const older = await createContestInNewYear()
  const newer = await createContestInNewYear()
  await deleteContest(await readEducatorId(newer.contestId), newer.contestId)
  const created = new Set([older.contestId, newer.contestId])

  const contests = await readEveryAdminContest()

  expect(
    contests
      .filter(({ id }) => created.has(id))
      .map(({ id, isInTrash }) => [id, isInTrash]),
  ).toStrictEqual([
    [older.contestId, false],
    [newer.contestId, true],
  ])
})

test(`the admin sees the players of a contest in the trash`, async () => {
  const { contestId } = await createContestInNewYear()
  await addPlayer(contestId, `Maya R.`)
  await deleteContest(await readEducatorId(contestId), contestId)

  const contest = await readAdminContest(contestId)

  expect(contest?.players).toMatchObject([
    { displayName: `Maya R.`, isInTrash: true },
  ])
})

test(`a deleted contest can't be hidden`, async () => {
  await addYear({ published: true })
  const educatorId = await createMember(`${randomUUID()}.edu`)
  const id = await addContest(educatorId, `A`)
  await deleteContest(educatorId, id)

  await expect(setContestHidden(id, true)).resolves.toBe(false)
})

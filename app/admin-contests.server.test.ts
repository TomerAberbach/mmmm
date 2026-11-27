import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import {
  addSubmission,
  createContestInNewYear,
  readEducatorId,
} from '../test/contests.ts'
import { createMember } from '../test/educators.ts'
import { waitForBlockedQuery } from '../test/locks.ts'
import { formPost } from '../test/sign-in.ts'
import { addYear } from '../test/years.ts'
import {
  readAdminContest,
  readAdminContests,
  renameContestAsAdmin,
  setContestHidden,
} from './admin-contests.server.ts'
import type { AdminContest } from './admin-contests.server.ts'
import { prisma } from './db.server.ts'
import { action as eraseAction } from './routes/admin.contests.$contestId.erase-contest.ts'
import { action as renameAction } from './routes/admin.contests.$contestId.name.ts'
import { action as hideAction } from './routes/admin.contests.hidden.ts'
import { deleteContest } from './trash.server.ts'
import { withCurrentYearAlone } from './years.server.ts'

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

test.each([
  { scenario: `in a past year`, isOrphaned: false, isInTrash: false },
  { scenario: `orphaned`, isOrphaned: true, isInTrash: false },
  { scenario: `in the trash`, isOrphaned: false, isInTrash: true },
])(`the admin renames a contest $scenario`, async state => {
  const { contestId } = await createContestInNewYear()
  await addYear({ published: true })
  await prisma.contest.update({
    where: { id: contestId },
    data: {
      ...(state.isOrphaned && { educatorId: null }),
      ...(state.isInTrash && { deletedAt: new Date() }),
    },
  })

  await expect(renameContestAsAdmin(contestId, `New name`)).resolves.toBe(true)

  const read = await readAdminContest(contestId)
  expect(read?.contest.name).toBe(`New name`)
})

test(`the admin's name for a contest skips the offensive word filter`, async () => {
  const { contestId } = await createContestInNewYear()

  await renameAction({
    request: formPost({ name: `Shit` }),
    params: { contestId },
  } as never)

  const read = await readAdminContest(contestId)
  expect(read?.contest.name).toBe(`Shit`)
})

test(`renaming a contest waits for a change that takes the years alone`, async () => {
  const { contestId } = await createContestInNewYear()
  let renamed: Promise<boolean> | undefined

  const nameMeanwhile = await withCurrentYearAlone(async tx => {
    renamed = renameContestAsAdmin(contestId, `New name`)
    await waitForBlockedQuery()
    return tx.contest.findUnique({
      where: { id: contestId },
      select: { name: true },
    })
  })

  expect(nameMeanwhile?.name).not.toBe(`New name`)
  await expect(renamed).resolves.toBe(true)
})

test(`the admin can't rename a contest that's gone`, async () => {
  await expect(renameContestAsAdmin(`gone`, `New name`)).resolves.toBe(false)
})

test(`hiding a contest in the trash says it can't be`, async () => {
  const { contestId } = await createContestInNewYear()
  await deleteContest(await readEducatorId(contestId), contestId)

  const reply = await hideAction({
    request: formPost({ contestId, isHidden: `true` }),
  } as never)

  expect(reply).toMatchObject({
    data: {
      error: `This contest can’t be hidden or shown now. Reload the page`,
    },
    init: { status: 409 },
  })
})

test(`erasing a contest that's gone says so`, async () => {
  const reply = await eraseAction({
    request: formPost({ confirmation: `Period 2 Biology` }),
    params: { contestId: `gone` },
  } as never)

  expect(JSON.stringify(reply)).toContain(
    `This contest is gone. Reload the page`,
  )
})

import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import {
  addContest,
  addPlayer,
  addSubmission,
  readLinkSecret,
} from '../test/contests.ts'
import { createMember } from '../test/educators.ts'
import { addYear, setLocked } from '../test/years.ts'
import { prisma } from './db.server.ts'
import { deleteEducator } from './educator-deletion.server.ts'
import { readLeaderboard } from './leaderboards.server.ts'
import type { LeaderboardScope } from './leaderboards.server.ts'
import { readContestOrganization } from './organizations.server.ts'
import { createPlayer, readContestPlayer } from './players.server.ts'
import { readColleagues, shareContest } from './shares.server.ts'
import { deleteContest } from './trash.server.ts'

/** An educator with a contest that has an approved submission */
const createEducatorWithContest = async () => {
  const year = await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const educatorId = await createMember(domain)
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const player = await addPlayer(contestId)
  await addSubmission(player.id, `APPROVED`)
  const email = `${educatorId}@${domain}`
  return { year, domain, educatorId, email, contestId, player }
}

test(`a deleted educator's contest keeps its players`, async () => {
  const { educatorId, email, contestId, player } =
    await createEducatorWithContest()

  await expect(deleteEducator(educatorId, email)).resolves.toBe(true)

  await expect(
    prisma.educator.findUnique({ where: { id: educatorId } }),
  ).resolves.toBeNull()
  await expect(
    readContestPlayer(contestId, player.secret),
  ).resolves.toMatchObject({
    id: player.id,
  })
})

test(`another address deletes nothing`, async () => {
  const { educatorId } = await createEducatorWithContest()

  await expect(deleteEducator(educatorId, `other@example.com`)).resolves.toBe(
    false,
  )

  await expect(
    prisma.educator.count({ where: { id: educatorId } }),
  ).resolves.toBe(1)
})

test(`an orphaned contest takes no new players`, async () => {
  const { educatorId, email, contestId } = await createEducatorWithContest()
  await deleteEducator(educatorId, email)

  const player = await createPlayer(
    await readLinkSecret(contestId),
    `Leo M.`,
    () => Promise.resolve(undefined),
  )

  expect(player).toStrictEqual({ refusal: `ORPHANED` })
})

test(`an orphaned contest stays on its leaderboards`, async () => {
  const { year, domain, educatorId, email, contestId, player } =
    await createEducatorWithContest()
  const viewer = {
    kind: `educator`,
    educatorId: await createMember(domain),
  } as const
  await deleteEducator(educatorId, email)
  await setLocked(year)
  const scopes: LeaderboardScope[] = [
    { kind: `contest`, contestId, year },
    { kind: `organization`, domain, year },
    { kind: `global`, year },
  ]

  const labels: string[] = []
  for (const scope of scopes) {
    const leaderboard = await readLeaderboard(scope, viewer, 1)
    labels.push(
      ...leaderboard!.rows
        .filter(({ playerId }) => playerId === player.id)
        .map(({ label }) => label),
    )
  }

  expect(labels).toStrictEqual([
    `Player`,
    `Player from Period 2 Biology`,
    `Player`,
  ])
  await expect(readContestOrganization(contestId)).resolves.toStrictEqual({
    domain,
    name: null,
  })
})

test(`a deleted educator's shares end`, async () => {
  const { domain, educatorId, email, contestId } =
    await createEducatorWithContest()
  const colleagueId = await createMember(domain)
  await shareContest(educatorId, contestId, `${colleagueId}@${domain}`)

  await deleteEducator(educatorId, email)

  await expect(readColleagues(contestId)).resolves.toStrictEqual([])
  await expect(prisma.share.count({ where: { contestId } })).resolves.toBe(0)
})

test(`a deleted educator's trash waits in the orphaned contest`, async () => {
  const { educatorId, email, contestId } = await createEducatorWithContest()
  await deleteContest(educatorId, contestId)

  await deleteEducator(educatorId, email)

  await expect(
    prisma.contest.findUnique({
      where: { id: contestId },
      select: { educatorId: true, deletedAt: true },
    }),
  ).resolves.toStrictEqual({
    educatorId: null,
    deletedAt: expect.any(Date) as Date,
  })
})

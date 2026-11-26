import { randomUUID } from 'node:crypto'
import { expect, onTestFinished, test, vi } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { addSubmission } from '../test/contests.ts'
import { createMember } from '../test/educators.ts'
import { addYear, setLocked } from '../test/years.ts'
import { hasReportablePlayer } from './contest-players.server.ts'
import {
  findReportableContestId,
  readEducatorScopes,
  toContestScope,
} from './leaderboard-scopes.server.ts'
import { readLeaderboard } from './leaderboards.server.ts'
import { deleteOwnPlayer } from './trash.server.ts'

test(`a row's contest is found only on the reporter's leaderboards`, async () => {
  const year = await addYear({ published: true })
  const educatorId = await createMember(`${randomUUID()}.edu`)
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: approvedId } = await addPlayer(contestId)
  await addSubmission(approvedId, `APPROVED`)
  const { id: pendingId } = await addPlayer(contestId)
  await addSubmission(pendingId, `PENDING`)
  await setLocked(year)
  const scopes = await readEducatorScopes(educatorId, year)
  const viewer = { kind: `educator`, educatorId } as const
  const otherScope = toContestScope({ id: `other`, name: `Other`, year })

  await expect(
    findReportableContestId(scopes, approvedId, viewer),
  ).resolves.toBe(contestId)
  await expect(
    findReportableContestId(scopes, pendingId, viewer),
  ).resolves.toBeNull()
  await expect(
    findReportableContestId([otherScope], approvedId, viewer),
  ).resolves.toBeNull()
})

/** An approved player named "Player", as a reporter in the organization sees */
const createUnnamedRow = async () => {
  const year = await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const educatorId = await createMember(domain)
  const reporterId = await createMember(domain)
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: playerId } = await addPlayer(contestId, `Player`)
  await addSubmission(playerId, `APPROVED`)
  await setLocked(year)
  return { year, educatorId, reporterId, contestId, playerId }
}

const goToNameRemoval = (year: number): void => {
  vi.useFakeTimers({ toFake: [`Date`], now: Date.UTC(year + 2, 5) })
  onTestFinished(() => {
    vi.useRealTimers()
  })
}

test(`a removed name's row that shows its contest can be reported`, async () => {
  const { year, reporterId, contestId, playerId } = await createUnnamedRow()
  goToNameRemoval(year)
  const viewer = { kind: `educator`, educatorId: reporterId } as const
  const scopes = await readEducatorScopes(reporterId, year)

  const leaderboard = await readLeaderboard(scopes[0]!.scope, viewer, 1)
  const found = await findReportableContestId(scopes, playerId, viewer)

  expect(leaderboard?.rows).toMatchObject([
    {
      label: `Player from Period 2 Biology (Ms. Frizzle)`,
      isNameRemoved: false,
    },
  ])
  expect(found).toBe(contestId)
})

test(`a row whose label is a removed name can't be reported`, async () => {
  const { year, educatorId, playerId } = await createUnnamedRow()
  goToNameRemoval(year)
  const viewer = { kind: `educator`, educatorId } as const
  const scopes = await readEducatorScopes(educatorId, year)

  const leaderboard = await readLeaderboard(scopes[0]!.scope, viewer, 1)
  const found = await findReportableContestId(scopes, playerId, viewer)

  expect(leaderboard?.rows).toMatchObject([
    { label: `Player`, isNameRemoved: true },
  ])
  expect(found).toBeNull()
})

test(`a player who entered "Player" as their name can be reported before names are removed`, async () => {
  const { year, educatorId, contestId, playerId } = await createUnnamedRow()
  const viewer = { kind: `educator`, educatorId } as const
  const scopes = await readEducatorScopes(educatorId, year)

  const leaderboard = await readLeaderboard(scopes[0]!.scope, viewer, 1)
  const found = await findReportableContestId(scopes, playerId, viewer)

  expect(leaderboard?.rows).toMatchObject([
    { label: `Player`, isNameRemoved: false },
  ])
  expect(found).toBe(contestId)
})

test.each([
  [`isn't removed`, false, true],
  [`was removed`, true, false],
])(`a contest's player whose name %s`, async (_, isRemoved, expected) => {
  const { year, contestId, playerId } = await createUnnamedRow()
  if (isRemoved) {
    goToNameRemoval(year)
  }

  const isReportable = await hasReportablePlayer(
    { id: contestId, year },
    playerId,
  )

  expect(isReportable).toBe(expected)
})

test(`a deleted player can't be reported`, async () => {
  const { year, contestId, playerId } = await createUnnamedRow()
  await deleteOwnPlayer(playerId)

  const isReportable = await hasReportablePlayer(
    { id: contestId, year },
    playerId,
  )

  expect(isReportable).toBe(false)
})

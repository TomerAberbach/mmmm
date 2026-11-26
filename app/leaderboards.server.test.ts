import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import {
  addContest,
  addPlayer,
  addSubmission,
  createContestInNewYear,
  readEducatorId,
} from '../test/contests.ts'
import { createEducator, createMember } from '../test/educators.ts'
import { pickEveryBattle } from '../test/picks.ts'
import { readSeededBracket } from '../test/results.ts'
import { addYear, setLocked } from '../test/years.ts'
import { setContestHidden } from './admin-contests.server.ts'
import { prisma } from './db.server.ts'
import type { SubmissionStatus } from './generated/prisma/client.ts'
import {
  readLeaderboard,
  readLeaderboardSubmission,
  readPlayerRank,
} from './leaderboards.server.ts'
import type {
  LeaderboardScope,
  LeaderboardViewer,
} from './leaderboards.server.ts'
import { submitPlayerPicks } from './player-picks.server.ts'
import { deletePlayers } from './trash.server.ts'

type TestContest = { contestId: string; year: number }

const toScope = (contest: TestContest): LeaderboardScope => ({
  kind: `contest`,
  ...contest,
})

const asEducator = async (contestId: string): Promise<LeaderboardViewer> => ({
  kind: `educator`,
  educatorId: await readEducatorId(contestId),
})

const asPlayer = (contestId: string, playerId: string): LeaderboardViewer => ({
  kind: `player`,
  contestId,
  playerId,
})

/** Adds a submission with the score. `minute` orders when its picks changed */
const addScored = async (
  contestId: string,
  displayName: string,
  score: number,
  {
    minute = 0,
    status = `APPROVED`,
  }: { minute?: number; status?: SubmissionStatus } = {},
): Promise<string> => {
  const { id } = await addPlayer(contestId, displayName)
  await addSubmission(id, status)
  await prisma.submission.update({
    where: { playerId: id },
    data: { score, picksChangedAt: new Date(Date.UTC(2027, 2, 14, 9, minute)) },
  })
  return id
}

/** Reads the first page's rows once the scope's year locks */
const readRows = async (scope: LeaderboardScope, viewer: LeaderboardViewer) => {
  await setLocked(scope.year)
  return (await readLeaderboard(scope, viewer, 1))!.rows
}

const readRanks = async (contest: TestContest) =>
  (await readRows(toScope(contest), await asEducator(contest.contestId))).map(
    ({ rank, label, score }) => [rank, label, score],
  )

test(`tied scores rank by when the picks last changed, and share a rank only at the same time`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await addScored(contestId, `Late`, 40, { minute: 5 })
  await addScored(contestId, `Early A`, 40)
  await addScored(contestId, `Early B`, 40)
  await addScored(contestId, `Best`, 64, { minute: 9 })

  const ranks = await readRanks({ contestId, year })

  expect(
    Object.fromEntries(ranks.map(([rank, name]) => [name, rank])),
  ).toStrictEqual({
    Best: 1,
    'Early A': 2,
    'Early B': 2,
    Late: 4,
  })
})

test.each<SubmissionStatus>([`PENDING`, `REJECTED`])(
  `a %s submission has no row`,
  async status => {
    const { contestId, year } = await createContestInNewYear()
    await addScored(contestId, `Maya R.`, 40, { status })

    await expect(readRanks({ contestId, year })).resolves.toStrictEqual([])
  },
)

test(`a submission in the trash has no row`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addScored(contestId, `Maya R.`, 40)
  await deletePlayers(await readEducatorId(contestId), contestId, [id])

  await expect(readRanks({ contestId, year })).resolves.toStrictEqual([])
})

test(`a player sees the names of the top 3 score tiers and their own`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await addScored(contestId, `First`, 50)
  await addScored(contestId, `Second`, 40)
  await addScored(contestId, `Second too`, 40, { minute: 1 })
  await addScored(contestId, `Third`, 30)
  await addScored(contestId, `Fourth`, 20)
  const ownId = await addScored(contestId, `Own`, 10)

  const rows = await readRows(
    toScope({ contestId, year }),
    asPlayer(contestId, ownId),
  )

  expect(rows.map(({ label, isOwn }) => [label, isOwn])).toStrictEqual([
    [`First`, false],
    [`Second`, false],
    [`Second too`, false],
    [`Third`, false],
    [`Player`, false],
    [`Own`, true],
  ])
})

test(`an educator sees every name`, async () => {
  const { contestId, year } = await createContestInNewYear()
  for (const score of [50, 40, 30, 20]) {
    await addScored(contestId, `Scored ${score}`, score)
  }

  const rows = await readRows(
    toScope({ contestId, year }),
    await asEducator(contestId),
  )

  expect(rows.at(-1)?.label).toBe(`Scored 20`)
})

test(`a row opens its submission, hiding the name as the leaderboard does`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const bracket = await readSeededBracket(year)
  const { id } = await addPlayer(contestId)
  await submitPlayerPicks(id, pickEveryBattle(bracket))
  await prisma.submission.update({
    where: { playerId: id },
    data: { status: `APPROVED` },
  })
  for (const score of [138, 137, 136]) {
    await addScored(contestId, `Scored ${score}`, score)
  }

  await setLocked(year)

  const submission = await readLeaderboardSubmission(
    toScope({ contestId, year }),
    id,
    asPlayer(contestId, `someone`),
  )

  expect(submission).toMatchObject({
    row: { label: `Player`, rank: 4 },
    picks: pickEveryBattle(bracket),
  })
})

test(`a submission without a row doesn't open`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const pendingId = await addScored(contestId, `Maya R.`, 40, {
    status: `PENDING`,
  })
  const other = await createContestInNewYear()
  const otherId = await addScored(other.contestId, `Other`, 40)

  await setLocked(year)

  const scope = toScope({ contestId, year })
  const viewer = await asEducator(contestId)
  await expect(
    readLeaderboardSubmission(scope, pendingId, viewer),
  ).resolves.toBeNull()
  await expect(
    readLeaderboardSubmission(scope, otherId, viewer),
  ).resolves.toBeNull()
})

test(`an open year has no leaderboard, and its submissions don't open`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addScored(contestId, `Maya R.`, 0)
  const scope = toScope({ contestId, year })
  const viewer = await asEducator(contestId)

  const rows = await readLeaderboard(scope, viewer, 1)
  const submission = await readLeaderboardSubmission(scope, id, viewer)

  expect([rows, submission]).toStrictEqual([null, null])
})

/**
 * A new year with a contest of each of two educators in one organization, and
 * one in none
 */
const createOrganizationContests = async () => {
  const year = await addYear({ published: true })
  const domain = `${randomUUID()}.edu`
  const addEducatorContest = async (
    name: string,
    contestName: string,
    educatorDomain: string,
  ) => {
    const educatorId = await createMember(educatorDomain, name)
    return addContest(educatorId, contestName)
  }
  return {
    scope: { kind: `organization`, domain, year } as const,
    own: await addEducatorContest(`Ms. Frizzle`, `Period 2 Biology`, domain),
    colleague: await addEducatorContest(`Mr. Ruhle`, `Science Club`, domain),
    outside: await addEducatorContest(`Ms. Byrd`, `Period 1`, `gmail.com`),
  }
}

test(`an organization's leaderboard ranks every contest in it`, async () => {
  const { scope, own, colleague, outside } = await createOrganizationContests()
  await addScored(own, `Own`, 50)
  await addScored(colleague, `Colleague's`, 60)
  await addScored(outside, `Outside`, 70)

  const rows = await readRows(scope, await asEducator(own))

  expect(rows.map(({ rank, label }) => [rank, label])).toStrictEqual([
    [1, `Player from Science Club (Mr. Ruhle)`],
    [2, `Own`],
  ])
})

test(`an organization's leaderboard shows a player only their own contest's top names`, async () => {
  const { scope, own, colleague } = await createOrganizationContests()
  await addScored(colleague, `Colleague's`, 60)
  for (const score of [50, 40, 30, 20]) {
    await addScored(own, `Own ${score}`, score)
  }
  const ownId = await addScored(own, `Me`, 10)

  const rows = await readRows(scope, asPlayer(own, ownId))

  expect(rows.map(({ label }) => label)).toStrictEqual([
    `Player from Science Club (Mr. Ruhle)`,
    `Own 50`,
    `Own 40`,
    `Own 30`,
    `Player from Period 2 Biology (Ms. Frizzle)`,
    `Me`,
  ])
})

test(`a colleague's bracket opens without its name`, async () => {
  const { scope, own, colleague } = await createOrganizationContests()
  const id = await addScored(colleague, `Colleague's`, 60)
  await setLocked(scope.year)

  const submission = await readLeaderboardSubmission(
    scope,
    id,
    await asEducator(own),
  )

  expect(submission?.row.label).toBe(`Player from Science Club (Mr. Ruhle)`)
})

/** One more than an organization leaderboard's page */
const MANY = 101

/** Adds that many approved submissions, with scores that count down from it */
const addManyScored = async (contestId: string): Promise<void> => {
  const ids = Array.from(
    { length: MANY },
    (_, index) => `${contestId}-${index}`,
  )
  await prisma.player.createMany({
    data: ids.map((id, index) => ({
      id,
      contestId,
      displayName: `Player ${index}`,
      personalLinkHash: id,
      linkVersion: 1,
    })),
  })
  await prisma.submission.createMany({
    data: ids.map((playerId, index) => ({
      playerId,
      status: `APPROVED` as const,
      score: MANY - index,
      picksChangedAt: new Date(),
    })),
  })
}

test.each([
  { page: 2, scenario: `the last page` },
  { page: 9, scenario: `a page past it` },
])(`$scenario continues the ranks`, async ({ page }) => {
  const { scope, own } = await createOrganizationContests()
  await addManyScored(own)
  await setLocked(scope.year)

  const leaderboard = await readLeaderboard(scope, await asEducator(own), page)

  expect(leaderboard).toMatchObject({
    page: { number: 2, count: 2 },
    rows: [{ rank: MANY, label: `Player 100` }],
  })
})

test(`a contest's leaderboard is one page`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await addManyScored(contestId)

  const rows = await readRows(
    toScope({ contestId, year }),
    await asEducator(contestId),
  )

  expect(rows).toHaveLength(MANY)
})

test(`a colleague sees every name in a contest shared with them`, async () => {
  const { scope, own, colleague } = await createOrganizationContests()
  await addScored(colleague, `Colleague's`, 60)
  const viewer = await asEducator(own)
  await prisma.share.create({
    data: { contestId: colleague, educatorId: await readEducatorId(own) },
  })

  const rows = await readRows(scope, viewer)

  expect(rows.map(({ label }) => label)).toStrictEqual([`Colleague's`])
})

test(`the global leaderboard ranks every confirmed educator's contest`, async () => {
  const { scope, own, colleague, outside } = await createOrganizationContests()
  const unconfirmed = await addContest(await createEducator(), `Unconfirmed`)
  await prisma.organization.update({
    where: { domain: scope.domain },
    data: { name: `Springfield High` },
  })
  await addScored(own, `Own`, 50)
  await addScored(colleague, `Colleague's`, 60)
  await addScored(outside, `Outside`, 70)
  await addScored(unconfirmed, `Unconfirmed`, 80)

  const rows = await readRows(
    { kind: `global`, year: scope.year },
    await asEducator(own),
  )

  expect(rows.map(({ rank, label }) => [rank, label])).toStrictEqual([
    [1, `Player`],
    [2, `Player from Springfield High`],
    [3, `Own`],
  ])
})

test(`the global leaderboard doesn't name an organization by its domain`, async () => {
  const { scope, own, outside } = await createOrganizationContests()
  await addScored(own, `Own`, 50)

  const rows = await readRows(
    { kind: `global`, year: scope.year },
    await asEducator(outside),
  )

  expect(rows.map(({ label }) => label)).toStrictEqual([`Player`])
})

test(`a hidden contest keeps only its own leaderboard`, async () => {
  const { scope, own, colleague } = await createOrganizationContests()
  const id = await addScored(own, `Own`, 50)
  await addScored(colleague, `Colleague's`, 60)
  await setContestHidden(own, true)
  const viewer = await asEducator(own)
  const contestScope = toScope({ contestId: own, year: scope.year })
  const globalScope = { kind: `global`, year: scope.year } as const

  await expect(readRows(contestScope, viewer)).resolves.toHaveLength(1)
  for (const hiding of [scope, globalScope]) {
    expect(
      (await readRows(hiding, viewer)).map(({ playerId }) => playerId),
    ).not.toContain(id)
    await expect(readPlayerRank(hiding, id)).resolves.toBeNull()
  }
  await expect(readPlayerRank(contestScope, id)).resolves.toStrictEqual({
    rank: 1,
    total: 1,
  })
})

test(`a player's rank matches the leaderboard's`, async () => {
  const { scope, own, colleague } = await createOrganizationContests()
  for (const [index, score] of [30, 40, 40, 50].entries()) {
    await addScored(index % 2 === 0 ? own : colleague, `Player ${index}`, score)
  }

  const rows = await readRows(scope, await asEducator(own))

  await expect(
    Promise.all(rows.map(({ playerId }) => readPlayerRank(scope, playerId))),
  ).resolves.toStrictEqual(rows.map(({ rank }) => ({ rank, total: 4 })))
})

test(`a submission that isn't approved has no rank`, async () => {
  const { scope, own } = await createOrganizationContests()
  const { id } = await addPlayer(own)
  await addSubmission(id, `PENDING`)

  await expect(readPlayerRank(scope, id)).resolves.toBeNull()
})

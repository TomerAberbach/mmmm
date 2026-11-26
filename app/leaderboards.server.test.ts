import { expect, test } from 'vitest'
import {
  addPlayer,
  addSubmission,
  createContestInNewYear,
  readEducatorId,
} from '../test/contests.ts'
import { pickEveryBattle } from '../test/picks.ts'
import { readSeededBracket } from '../test/results.ts'
import { setLocked } from '../test/years.ts'
import { prisma } from './db.server.ts'
import type { SubmissionStatus } from './generated/prisma/client.ts'
import {
  readContestLeaderboard,
  readLeaderboardSubmission,
} from './leaderboards.server.ts'
import type { LeaderboardViewer } from './leaderboards.server.ts'
import { submitPlayerPicks } from './player-picks.server.ts'
import { deletePlayers } from './trash.server.ts'

const EDUCATOR: LeaderboardViewer = { sees: `everyName` }

const asPlayer = (playerId: string): LeaderboardViewer => ({
  sees: `topNames`,
  ownPlayerId: playerId,
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

/** Reads the rows once the contest's year locks */
const readRows = async (
  contest: { id: string; year: number },
  viewer: LeaderboardViewer = EDUCATOR,
) => {
  await setLocked(contest.year)
  return (await readContestLeaderboard(contest, viewer))!
}

const readRanks = async (contest: { id: string; year: number }) =>
  (await readRows(contest)).map(({ rank, label, score }) => [
    rank,
    label,
    score,
  ])

test(`tied scores rank by when the picks last changed, and share a rank only at the same time`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await addScored(contestId, `Late`, 40, { minute: 5 })
  await addScored(contestId, `Early A`, 40)
  await addScored(contestId, `Early B`, 40)
  await addScored(contestId, `Best`, 64, { minute: 9 })

  const ranks = await readRanks({ id: contestId, year })

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

    await expect(readRanks({ id: contestId, year })).resolves.toStrictEqual([])
  },
)

test(`a submission in the trash has no row`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addScored(contestId, `Maya R.`, 40)
  await deletePlayers(await readEducatorId(contestId), contestId, [id])

  await expect(readRanks({ id: contestId, year })).resolves.toStrictEqual([])
})

test(`a player sees the names of the top 3 score tiers and their own`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await addScored(contestId, `First`, 50)
  await addScored(contestId, `Second`, 40)
  await addScored(contestId, `Second too`, 40, { minute: 1 })
  await addScored(contestId, `Third`, 30)
  await addScored(contestId, `Fourth`, 20)
  const ownId = await addScored(contestId, `Own`, 10)

  const rows = await readRows({ id: contestId, year }, asPlayer(ownId))

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

  const rows = await readRows({ id: contestId, year })

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
    { id: contestId, year },
    id,
    asPlayer(`someone`),
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

  const contest = { id: contestId, year }
  await expect(
    readLeaderboardSubmission(contest, pendingId, EDUCATOR),
  ).resolves.toBeNull()
  await expect(
    readLeaderboardSubmission(contest, otherId, EDUCATOR),
  ).resolves.toBeNull()
})

test(`an open year has no leaderboard, and its submissions don't open`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const id = await addScored(contestId, `Maya R.`, 0)
  const contest = { id: contestId, year }

  const rows = await readContestLeaderboard(contest, EDUCATOR)
  const submission = await readLeaderboardSubmission(contest, id, EDUCATOR)

  expect([rows, submission]).toStrictEqual([null, null])
})

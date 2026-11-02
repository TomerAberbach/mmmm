import { expect, test } from 'vitest'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { createEducator } from '../test/educators.ts'
import { createBracket, setBracketPublished } from './brackets.server.ts'
import { createContest } from './contests.server.ts'
import { prisma } from './db.server.ts'
import { listContenders, pickWinner, toPickBracket } from './picks.ts'
import {
  createPlayer,
  readContestPlayer,
  readPlayerByLink,
  readPlayerPicks,
  savePlayerPicks,
} from './players.server.ts'

// The test database is shared across this run, so this file uses years of its
// own, below the ones brackets.server.test.ts publishes as the current year
let nextYear = 2300

const createContestInNewYear = async (): Promise<{
  contestId: string
  year: number
}> => {
  const year = nextYear++
  await createBracket(year, BRACKET_2026)
  await setBracketPublished(year, true)
  const contestId = await createContest(
    await createEducator(),
    year,
    `Period 2 Biology`,
  )
  return { contestId: contestId!, year }
}

// Creates a player in a new year's contest
const startDraft = async (): Promise<{ playerId: string; year: number }> => {
  const { contestId, year } = await createContestInNewYear()
  const secret = await createPlayer(contestId, `Maya R.`)
  const player = await readContestPlayer(contestId, secret)
  return { playerId: player!.id, year }
}

const BRACKET = toPickBracket(BRACKET_2026)
const [CHAMPION = ``] = listContenders(BRACKET, {
  round: `CHAMPIONSHIP`,
  index: 0,
})
const CHAMPION_PICKS = pickWinner(
  BRACKET,
  {},
  { round: `CHAMPIONSHIP`, index: 0 },
  CHAMPION,
).picks

test(`a player's personal link finds their contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const secret = await createPlayer(contestId, `Maya R.`)

  const player = await readPlayerByLink(secret)

  expect(player).toMatchObject({ contestId })
})

test(`a personal link finds the player only in their own contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const { contestId: otherContestId } = await createContestInNewYear()
  const secret = await createPlayer(contestId, `Maya R.`)

  const inOwnContest = await readContestPlayer(contestId, secret)
  const inOtherContest = await readContestPlayer(otherContestId, secret)

  expect(inOwnContest).toMatchObject({ displayName: `Maya R.` })
  expect(inOtherContest).toBeNull()
})

test(`a link that matches no player finds nothing`, async () => {
  await expect(readPlayerByLink(`not-a-personal-link`)).resolves.toBeNull()
})

test(`the database stores no working personal link`, async () => {
  const { contestId } = await createContestInNewYear()
  const secret = await createPlayer(contestId, `Maya R.`)

  const rows = await prisma.player.findMany({
    where: { contestId },
    select: { personalLinkHash: true },
  })

  expect(rows.map(({ personalLinkHash }) => personalLinkHash)).not.toContain(
    secret,
  )
})

test(`a player's saved picks read back as saved`, async () => {
  const { playerId, year } = await startDraft()

  const saved = await savePlayerPicks(playerId, year, CHAMPION_PICKS)

  expect(saved).toBe(true)
  await expect(readPlayerPicks(playerId)).resolves.toStrictEqual(CHAMPION_PICKS)
})

test(`saving picks replaces the earlier ones and records when they changed`, async () => {
  const { playerId, year } = await startDraft()
  await savePlayerPicks(playerId, year, CHAMPION_PICKS)
  const fewerPicks = { 'ROUND_1:0': CHAMPION }

  await savePlayerPicks(playerId, year, fewerPicks)

  await expect(readPlayerPicks(playerId)).resolves.toStrictEqual(fewerPicks)
  const player = await prisma.player.findUniqueOrThrow({
    where: { id: playerId },
    select: { picksChangedAt: true },
  })
  expect(player.picksChangedAt).toBeInstanceOf(Date)
})

test(`picks that don't fit the bracket aren't saved`, async () => {
  const { playerId, year } = await startDraft()

  const saved = await savePlayerPicks(playerId, year, {
    'ROUND_2:0': CHAMPION,
  })

  expect(saved).toBe(false)
  await expect(readPlayerPicks(playerId)).resolves.toStrictEqual({})
})

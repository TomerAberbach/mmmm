import { expect, test } from 'vitest'
import { BRACKET_2026 } from '../prisma/brackets.ts'
import { createEducator } from '../test/educators.ts'
import { createBracket, setBracketPublished } from './brackets.server.ts'
import { createContest } from './contests.server.ts'
import { prisma } from './db.server.ts'
import {
  createPlayer,
  readContestPlayer,
  readPlayerByLink,
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

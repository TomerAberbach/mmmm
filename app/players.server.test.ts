import { expect, test, vi } from 'vitest'
import {
  addContest,
  addPlayer,
  createContestInNewYear,
} from '../test/contests.ts'
import { createEducator } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import { prisma } from './db.server.ts'
import type { LimitRefusal } from './limits.server.ts'
import {
  createPlayer,
  readContestPlayer,
  readPlayerByLink,
} from './players.server.ts'

test(`a player's personal link finds their contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const { secret } = await addPlayer(contestId)

  const player = await readPlayerByLink(secret)

  expect(player).toMatchObject({ contestId })
})

test(`a personal link finds the player only in their own contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const otherContestId = await addContest(
    await createEducator(),
    `Science Club`,
  )
  const { secret } = await addPlayer(contestId)

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
  const { secret } = await addPlayer(contestId)

  const rows = await prisma.player.findMany({
    where: { contestId },
    select: { personalLinkHash: true },
  })

  expect(rows.map(({ personalLinkHash }) => personalLinkHash)).not.toContain(
    secret,
  )
})

test(`a contest takes no players once a newer year is published, and costs the limit nothing`, async () => {
  const { contestId } = await createContestInNewYear()
  await addYear({ published: true })
  const limit = vi.fn(() => Promise.resolve(undefined))

  const player = await createPlayer(contestId, `Maya R.`, limit)

  expect(player).toStrictEqual({ refusal: `NOT_CURRENT_YEAR` })
  expect(limit).not.toHaveBeenCalled()
  await expect(prisma.player.count({ where: { contestId } })).resolves.toBe(0)
})

test(`a player the limit refuses isn't created`, async () => {
  const { contestId } = await createContestInNewYear()
  const limit: LimitRefusal = {
    message: `Too many new brackets right now. Try again in 5 minutes`,
    headers: { 'Retry-After': `300` },
  }

  const player = await createPlayer(contestId, `Maya R.`, () =>
    Promise.resolve(limit),
  )

  expect(player).toStrictEqual({ refusal: `LIMITED`, limit })
  await expect(prisma.player.count({ where: { contestId } })).resolves.toBe(0)
})

import { expect, test, vi } from 'vitest'
import { addContest, addPlayer, readLinkSecret } from '../prisma/fixtures.ts'
import {
  createContestInNewYear,
  orphan,
  readEducatorId,
} from '../test/contests.ts'
import { createEducator } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import { replaceContestLink } from './contests.server.ts'
import { prisma } from './db.server.ts'
import type { LimitRefusal } from './limits.server.ts'
import {
  createPlayer,
  readContestPlayer,
  readPersonalLink,
} from './players.server.ts'
import { deleteContest, deleteOwnPlayer } from './trash.server.ts'

test(`a player's personal link finds their contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const { secret } = await addPlayer(contestId)

  const player = await readPersonalLink(secret)

  expect(player).toMatchObject({ state: `active`, contestId })
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
  await expect(readPersonalLink(`not-a-personal-link`)).resolves.toBeNull()
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

  const player = await createPlayer(
    await readLinkSecret(contestId),
    `Maya R.`,
    limit,
  )

  expect(player).toStrictEqual({ refusal: `NOT_OPEN` })
  expect(limit).not.toHaveBeenCalled()
  await expect(prisma.player.count({ where: { contestId } })).resolves.toBe(0)
})

test(`a player the limit refuses isn't created`, async () => {
  const { contestId } = await createContestInNewYear()
  const limit: LimitRefusal = {
    message: `Too many new brackets right now. Try again in 5 minutes`,
    headers: { 'Retry-After': `300` },
  }

  const player = await createPlayer(
    await readLinkSecret(contestId),
    `Maya R.`,
    () => Promise.resolve(limit),
  )

  expect(player).toStrictEqual({ refusal: `LIMITED`, limit })
  await expect(prisma.player.count({ where: { contestId } })).resolves.toBe(0)
})

test(`a replaced contest link starts no players`, async () => {
  const { contestId } = await createContestInNewYear()
  const oldSecret = await readLinkSecret(contestId)
  await replaceContestLink(await readEducatorId(contestId), contestId)

  const player = await createPlayer(oldSecret, `Maya R.`, () =>
    Promise.resolve(undefined),
  )

  expect(player).toStrictEqual({ refusal: `BROKEN_LINK` })
})

/** The contest link's secret shown to a player who deletes their bracket */
const readStartLinkAfterDeleting = async (player: {
  id: string
  secret: string
}): Promise<string | null> => {
  await deleteOwnPlayer(player.id)
  const target = await readPersonalLink(player.secret)
  if (target?.state !== `deleted`) {
    throw new Error(`The player wasn't deleted`)
  }
  return target.startLinkSecret
}

test(`a deleted player starts again from the contest link`, async () => {
  const { contestId } = await createContestInNewYear()
  const player = await addPlayer(contestId)

  const linkSecret = await readStartLinkAfterDeleting(player)

  expect(linkSecret).not.toBeNull()
})

test(`a deleted player who started before the contest link was replaced isn't shown the new one`, async () => {
  const { contestId } = await createContestInNewYear()
  const player = await addPlayer(contestId)
  await replaceContestLink(await readEducatorId(contestId), contestId)

  const linkSecret = await readStartLinkAfterDeleting(player)

  expect(linkSecret).toBeNull()
})

test(`a deleted player who started with the new contest link starts again from it`, async () => {
  const { contestId } = await createContestInNewYear()
  await replaceContestLink(await readEducatorId(contestId), contestId)
  const player = await addPlayer(contestId)

  const linkSecret = await readStartLinkAfterDeleting(player)

  expect(linkSecret).not.toBeNull()
})

test(`a deleted player of a past year can't start again`, async () => {
  const { contestId } = await createContestInNewYear()
  const player = await addPlayer(contestId)
  await addYear({ published: true })

  const linkSecret = await readStartLinkAfterDeleting(player)

  expect(linkSecret).toBeNull()
})

test(`a deleted player's link says when the contest is orphaned`, async () => {
  const { contestId } = await createContestInNewYear()
  const player = await addPlayer(contestId)
  await deleteOwnPlayer(player.id)
  await orphan(contestId)

  const target = await readPersonalLink(player.secret)

  expect(target).toMatchObject({ state: `deleted`, isOrphaned: true })
})

test(`a deleted contest's player's link says when the contest is orphaned`, async () => {
  const { contestId } = await createContestInNewYear()
  const { secret } = await addPlayer(contestId)
  await deleteContest(await readEducatorId(contestId), contestId)
  await orphan(contestId)

  const target = await readPersonalLink(secret)

  expect(target).toStrictEqual({ state: `contestDeleted`, isOrphaned: true })
})

test(`a deleted player's link says when the year is past`, async () => {
  const { contestId } = await createContestInNewYear()
  const player = await addPlayer(contestId)
  await deleteOwnPlayer(player.id)
  await addYear({ published: true })

  const target = await readPersonalLink(player.secret)

  expect(target).toMatchObject({ state: `deleted`, isPast: true })
})

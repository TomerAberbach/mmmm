import { expect, test } from 'vitest'
import {
  addContest,
  addPlayer,
  addSubmission,
  createContestInNewYear,
  readEducatorId,
  readLinkSecret,
} from '../test/contests.ts'
import { createEducator } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import {
  readContestPlayers,
  renamePlayer,
  setSubmissionStatus,
} from './contest-players.server.ts'
import { readEducatorContest, readEducatorContests } from './contests.server.ts'
import { prisma } from './db.server.ts'
import { savePlayerDraft } from './player-picks.server.ts'
import {
  createPlayer,
  readContestPlayer,
  readPersonalLink,
} from './players.server.ts'
import {
  deleteContest,
  deleteOwnPlayer,
  deletePlayers,
  eraseContests,
  eraseExpiredPlayers,
  erasePlayer,
  erasePlayers,
  readDeletedContests,
  readDeletedPlayers,
  restoreContests,
  restorePlayers,
} from './trash.server.ts'

/** A contest with an approved player, and the educator who runs it */
const createContestWithPlayer = async () => {
  const { contestId, year } = await createContestInNewYear()
  const { id: playerId, secret } = await addPlayer(contestId, `Maya R.`)
  await addSubmission(playerId, `APPROVED`)
  const educatorId = await readEducatorId(contestId)
  return { contestId, year, educatorId, playerId, secret }
}

const listNames = (players: { displayName: string }[]) =>
  players.map(({ displayName }) => displayName)

test(`a deleted player moves to the trash, and their personal link turns off`, async () => {
  const { contestId, educatorId, playerId, secret } =
    await createContestWithPlayer()

  const count = await deletePlayers(educatorId, contestId, [playerId])

  expect(count).toBe(1)
  await expect(
    readContestPlayers(contestId, `OLDEST_FIRST`),
  ).resolves.toStrictEqual([])
  await expect(readDeletedPlayers(contestId)).resolves.toMatchObject([
    { displayName: `Maya R.`, status: `APPROVED`, deletedBy: `EDUCATOR` },
  ])
  await expect(readContestPlayer(contestId, secret)).resolves.toBeNull()
  await expect(readPersonalLink(secret)).resolves.toMatchObject({
    state: `deleted`,
    restoreBy: null,
  })
})

test(`a deleted player can't be changed outside the trash`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  await deletePlayers(educatorId, contestId, [playerId])

  const changed = await setSubmissionStatus(
    educatorId,
    contestId,
    [playerId],
    `REJECTED`,
  )
  const renamed = await renamePlayer(educatorId, contestId, playerId, `Bo`)
  const saved = await savePlayerDraft(playerId, {})

  expect([changed, renamed, saved]).toStrictEqual([
    0,
    false,
    { refusal: `DELETED` },
  ])
})

test(`a restored player keeps their status and personal link`, async () => {
  const { contestId, educatorId, playerId, secret } =
    await createContestWithPlayer()
  await deletePlayers(educatorId, contestId, [playerId])

  const count = await restorePlayers(educatorId, contestId, [playerId])

  expect(count).toBe(1)
  await expect(
    readContestPlayers(contestId, `OLDEST_FIRST`),
  ).resolves.toMatchObject([{ displayName: `Maya R.`, status: `APPROVED` }])
  await expect(readPersonalLink(secret)).resolves.toMatchObject({
    state: `active`,
  })
})

test(`erasing deletes only the listed players in the trash`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  const kept = await addPlayer(contestId, `Jonah K.`)
  const unlisted = await addPlayer(contestId, `Priya S.`)
  await deletePlayers(educatorId, contestId, [playerId, unlisted.id])

  const count = await erasePlayers(educatorId, contestId, [playerId, kept.id])

  expect(count).toBe(1)
  expect(
    listNames(await readContestPlayers(contestId, `OLDEST_FIRST`)),
  ).toStrictEqual([`Jonah K.`])
  expect(listNames(await readDeletedPlayers(contestId))).toStrictEqual([
    `Priya S.`,
  ])
})

test(`another educator can't delete, restore, or erase a player`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  const deleted = await addPlayer(contestId, `Jonah K.`)
  await deletePlayers(educatorId, contestId, [deleted.id])
  const otherId = await createEducator()

  const counts = [
    await deletePlayers(otherId, contestId, [playerId]),
    await restorePlayers(otherId, contestId, [deleted.id]),
    await erasePlayers(otherId, contestId, [deleted.id]),
  ]

  expect(counts).toStrictEqual([0, 0, 0])
})

test(`a player is deleted, restored, and erased only through their own contest`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  const otherContestId = await addContest(educatorId, `Period 5 Biology`)
  const deleted = await addPlayer(contestId, `Jonah K.`)
  await deletePlayers(educatorId, contestId, [deleted.id])

  const counts = [
    await deletePlayers(educatorId, otherContestId, [playerId]),
    await restorePlayers(educatorId, otherContestId, [deleted.id]),
    await erasePlayers(educatorId, otherContestId, [deleted.id]),
  ]

  expect(counts).toStrictEqual([0, 0, 0])
})

test(`a player's own deletion is marked as theirs`, async () => {
  const { contestId, playerId } = await createContestWithPlayer()

  const deleted = await deleteOwnPlayer(playerId)

  expect(deleted).toBe(true)
  await expect(readDeletedPlayers(contestId)).resolves.toMatchObject([
    { displayName: `Maya R.`, deletedBy: `PLAYER` },
  ])
})

test(`deleting a player again leaves who deleted them`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  await deleteOwnPlayer(playerId)

  const count = await deletePlayers(educatorId, contestId, [playerId])

  expect(count).toBe(0)
  await expect(readDeletedPlayers(contestId)).resolves.toMatchObject([
    { deletedBy: `PLAYER` },
  ])
})

test.each([
  [`PLAYER`, `2027-03-15T12:00:00Z`, []],
  [`PLAYER`, `2027-03-15T12:00:01Z`, [`Maya R.`]],
  [`EDUCATOR`, `2027-03-01T12:00:00Z`, [`Maya R.`]],
] as const)(
  `on March 22 at noon, a deletion by %s at %s leaves %j in the trash`,
  async (deletedBy, deletedAt, names) => {
    const { contestId, playerId } = await createContestWithPlayer()
    await prisma.player.update({
      where: { id: playerId },
      data: { deletedBy, deletedAt: new Date(deletedAt) },
    })

    await eraseExpiredPlayers(new Date(`2027-03-22T12:00:00Z`))

    expect(listNames(await readDeletedPlayers(contestId))).toStrictEqual(names)
  },
)

test(`a deleted contest leaves the educator's contests and turns off its players' links`, async () => {
  const { contestId, year, educatorId, secret } =
    await createContestWithPlayer()

  const deleted = await deleteContest(educatorId, contestId)

  expect(deleted).toBe(true)
  await expect(readEducatorContests(educatorId, year)).resolves.toStrictEqual(
    [],
  )
  await expect(readEducatorContest(educatorId, contestId)).resolves.toBeNull()
  await expect(readPersonalLink(secret)).resolves.toStrictEqual({
    state: `contestDeleted`,
  })
})

test(`a deleted contest's players can't be changed`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  await deleteContest(educatorId, contestId)

  const count = await deletePlayers(educatorId, contestId, [playerId])

  expect(count).toBe(0)
})

test(`a deleted contest counts its submissions and drafts, leaving out its trash`, async () => {
  const { contestId, year, educatorId } = await createContestWithPlayer()
  await addPlayer(contestId, `Leo M.`)
  const trashed = await addPlayer(contestId, `Jonah K.`)
  await deletePlayers(educatorId, contestId, [trashed.id])

  await deleteContest(educatorId, contestId)

  await expect(readDeletedContests(educatorId, year)).resolves.toMatchObject([
    { name: `Period 2 Biology`, submissionCount: 1, draftCount: 1 },
  ])
})

test(`a restored contest comes back with its players`, async () => {
  const { contestId, year, educatorId } = await createContestWithPlayer()
  await deleteContest(educatorId, contestId)

  const count = await restoreContests(educatorId, [contestId])

  expect(count).toBe(1)
  await expect(readEducatorContests(educatorId, year)).resolves.toMatchObject([
    { id: contestId },
  ])
  expect(
    listNames(await readContestPlayers(contestId, `OLDEST_FIRST`)),
  ).toStrictEqual([`Maya R.`])
})

test(`erasing a contest erases its players`, async () => {
  const { contestId, educatorId, secret } = await createContestWithPlayer()
  await deleteContest(educatorId, contestId)

  const count = await eraseContests(educatorId, [contestId])

  expect(count).toBe(1)
  await expect(readPersonalLink(secret)).resolves.toBeNull()
})

test(`a contest outside the trash can't be erased`, async () => {
  const { contestId, educatorId } = await createContestWithPlayer()

  await expect(eraseContests(educatorId, [contestId])).resolves.toBe(0)
})

test(`another educator can't delete, restore, or erase a contest`, async () => {
  const { contestId, educatorId } = await createContestWithPlayer()
  const otherId = await createEducator()

  const deleted = await deleteContest(otherId, contestId)
  await deleteContest(educatorId, contestId)
  const restored = await restoreContests(otherId, [contestId])
  const erased = await eraseContests(otherId, [contestId])

  expect([deleted, restored, erased]).toStrictEqual([false, 0, 0])
})

test(`the database refuses a deleted player without a deleter`, async () => {
  const { playerId } = await createContestWithPlayer()

  await expect(
    prisma.player.update({
      where: { id: playerId },
      data: { deletedAt: new Date() },
    }),
  ).rejects.toThrow(/Player_deletedBy_check/u)
})

test(`a deleted contest takes no players or picks`, async () => {
  const { contestId, educatorId, playerId } = await createContestWithPlayer()
  await deleteContest(educatorId, contestId)

  const created = await createPlayer(
    await readLinkSecret(contestId),
    `Jonah K.`,
    () => Promise.resolve(undefined),
  )
  const saved = await savePlayerDraft(playerId, {})

  expect([created, saved]).toStrictEqual([
    { refusal: `CONTEST_DELETED` },
    { refusal: `DELETED` },
  ])
})

test(`an admin erases a past year's player`, async () => {
  const { contestId, playerId } = await createContestWithPlayer()
  await addYear({ published: true })

  await expect(erasePlayer(contestId, playerId)).resolves.toBe(true)

  await expect(prisma.player.count({ where: { id: playerId } })).resolves.toBe(
    0,
  )
})

test(`an admin erases no player through another contest`, async () => {
  const { playerId } = await createContestWithPlayer()
  const other = await createContestWithPlayer()

  await expect(erasePlayer(other.contestId, playerId)).resolves.toBe(false)
})

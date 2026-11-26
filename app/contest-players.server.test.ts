import { expect, test } from 'vitest'
import {
  addContest,
  addPlayer,
  addSubmission,
  createContestInNewYear,
  readEducatorId,
} from '../test/contests.ts'
import { createEducator } from '../test/educators.ts'
import {
  readContestPlayers,
  renamePlayer,
  replacePersonalLink,
  setSubmissionStatus,
} from './contest-players.server.ts'
import { readContestPlayer } from './players.server.ts'
import { deletePlayers } from './trash.server.ts'

const readStatuses = async (
  contestId: string,
): Promise<Record<string, string | null>> =>
  Object.fromEntries(
    (await readContestPlayers(contestId)).map(({ displayName, status }) => [
      displayName,
      status,
    ]),
  )

test(`a contest's players are listed oldest first, drafts without a status`, async () => {
  const { contestId } = await createContestInNewYear()
  const maya = await addPlayer(contestId, `Maya R.`)
  await addSubmission(maya.id, `APPROVED`)
  await addPlayer(contestId, `Jonah K.`)

  const players = await readContestPlayers(contestId)

  expect(
    players.map(({ displayName, status }) => ({ displayName, status })),
  ).toStrictEqual([
    { displayName: `Maya R.`, status: `APPROVED` },
    { displayName: `Jonah K.`, status: null },
  ])
})

test.each([
  [`PENDING`, `APPROVED`],
  [`PENDING`, `REJECTED`],
  [`REJECTED`, `APPROVED`],
  [`APPROVED`, `REJECTED`],
] as const)(`an educator changes a %s submission to %s`, async (from, to) => {
  const { contestId } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)
  await addSubmission(id, from)

  const count = await setSubmissionStatus(
    await readEducatorId(contestId),
    contestId,
    [id],
    to,
  )

  expect(count).toBe(1)
  await expect(readStatuses(contestId)).resolves.toStrictEqual({
    'Maya R.': to,
  })
})

test(`a draft has no status to change`, async () => {
  const { contestId } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)

  const count = await setSubmissionStatus(
    await readEducatorId(contestId),
    contestId,
    [id],
    `APPROVED`,
  )

  expect(count).toBe(0)
  await expect(readStatuses(contestId)).resolves.toStrictEqual({
    'Maya R.': null,
  })
})

test(`another educator can't change a submission's status or rename its player`, async () => {
  const { contestId } = await createContestInNewYear()
  const { id } = await addPlayer(contestId)
  await addSubmission(id)
  const otherEducatorId = await createEducator()

  const count = await setSubmissionStatus(
    otherEducatorId,
    contestId,
    [id],
    `REJECTED`,
  )
  const renamed = await renamePlayer(otherEducatorId, contestId, id, `Bo`)

  expect([count, renamed]).toStrictEqual([0, false])
  await expect(readStatuses(contestId)).resolves.toStrictEqual({
    'Maya R.': `PENDING`,
  })
})

test(`a player is changed only through their own contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const educatorId = await readEducatorId(contestId)
  const otherContestId = await addContest(educatorId, `Period 5 Biology`)
  const { id } = await addPlayer(contestId)
  await addSubmission(id)

  const count = await setSubmissionStatus(
    educatorId,
    otherContestId,
    [id],
    `REJECTED`,
  )

  expect(count).toBe(0)
})

test(`an educator sets several submissions' statuses, leaving out drafts and other players`, async () => {
  const { contestId } = await createContestInNewYear()
  const pending = await addPlayer(contestId, `Maya R.`)
  await addSubmission(pending.id)
  const approved = await addPlayer(contestId, `Ava L.`)
  await addSubmission(approved.id, `APPROVED`)
  const draft = await addPlayer(contestId, `Leo M.`)
  const unlisted = await addPlayer(contestId, `Priya S.`)
  await addSubmission(unlisted.id)

  const count = await setSubmissionStatus(
    await readEducatorId(contestId),
    contestId,
    [pending.id, approved.id, draft.id],
    `REJECTED`,
  )

  expect(count).toBe(2)
  await expect(readStatuses(contestId)).resolves.toStrictEqual({
    'Maya R.': `REJECTED`,
    'Ava L.': `REJECTED`,
    'Leo M.': null,
    'Priya S.': `PENDING`,
  })
})

test(`an educator renames a player in their contest`, async () => {
  const { contestId } = await createContestInNewYear()
  const { id } = await addPlayer(contestId, `maya r`)

  const renamed = await renamePlayer(
    await readEducatorId(contestId),
    contestId,
    id,
    `Maya R.`,
  )

  expect(renamed).toBe(true)
  await expect(readStatuses(contestId)).resolves.toStrictEqual({
    'Maya R.': null,
  })
})

test(`a new personal link replaces the old one`, async () => {
  const { contestId } = await createContestInNewYear()
  const { id, secret: oldSecret } = await addPlayer(contestId)

  const newSecret = await replacePersonalLink(
    await readEducatorId(contestId),
    contestId,
    id,
  )

  await expect(readContestPlayer(contestId, oldSecret)).resolves.toBeNull()
  await expect(readContestPlayer(contestId, newSecret!)).resolves.toMatchObject(
    { id },
  )
})

test(`another educator can't replace a player's personal link`, async () => {
  const { contestId } = await createContestInNewYear()
  const { id, secret } = await addPlayer(contestId)

  const newSecret = await replacePersonalLink(
    await createEducator(),
    contestId,
    id,
  )

  expect(newSecret).toBeNull()
  await expect(readContestPlayer(contestId, secret)).resolves.toMatchObject({
    id,
  })
})

test(`a deleted player gets no new personal link`, async () => {
  const { contestId } = await createContestInNewYear()
  const educatorId = await readEducatorId(contestId)
  const { id } = await addPlayer(contestId)
  await deletePlayers(educatorId, contestId, [id])

  const newSecret = await replacePersonalLink(educatorId, contestId, id)

  expect(newSecret).toBeNull()
})

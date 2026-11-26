import { expect, test } from 'vitest'
import {
  addContest,
  addPlayer,
  createContestInNewYear,
  createPlayerInNewYear,
  readEducatorId,
  readLinkSecret,
} from '../test/contests.ts'
import { createEducator } from '../test/educators.ts'
import { crownChampion, lockYear, makeFirstResult } from '../test/results.ts'
import { addYear } from '../test/years.ts'
import {
  readAdminYears,
  readBracketSummary,
  readResultRows,
  setBracketPublished,
} from './brackets.server.ts'
import { createContest } from './contests.server.ts'
import {
  discardPlayerDraft,
  savePlayerDraft,
  submitPlayerPicks,
} from './player-picks.server.ts'
import { createPlayer, readPersonalLink } from './players.server.ts'
import type { ResultRequest } from './result-request.ts'
import { reopenSubmissions, saveResult } from './results.server.ts'
import { deletePlayers } from './trash.server.ts'

test(`the first result is saved and locks submissions`, async () => {
  const year = await addYear({ published: true })
  const request = await makeFirstResult(year)

  const saved = await saveResult(request)

  expect(saved).toStrictEqual({ saved: true })
  await expect(readResultRows(year)).resolves.toStrictEqual({
    'ROUND_1:0': request.winnerId,
  })
  await expect(readBracketSummary(year)).resolves.toMatchObject({
    phase: `IN_PROGRESS`,
    hasResults: true,
  })
})

test.each<[string, Partial<ResultRequest>]>([
  [`that didn't confirm the lock`, { locks: false }],
  [`with another previous winner`, { previousWinnerId: `someone` }],
  [`with other results to clear`, { cleared: [`ROUND_2:0`] }],
  [`whose winner isn't in the battle`, { winnerId: `someone` }],
  [`that clears a missing result`, { winnerId: null }],
  [`for a missing battle`, { battle: { round: `ROUND_1`, index: 99 } }],
])(`a result %s is refused`, async (_, change) => {
  const year = await addYear({ published: true })
  const request = await makeFirstResult(year)

  const saved = await saveResult({ ...request, ...change })

  expect(saved).toStrictEqual({ refusal: `STALE` })
  await expect(readResultRows(year)).resolves.toStrictEqual({})
  await expect(readBracketSummary(year)).resolves.toMatchObject({
    phase: `OPEN`,
  })
})

test(`repeating a saved result succeeds`, async () => {
  const year = await addYear({ published: true })
  const request = await makeFirstResult(year)
  await saveResult(request)

  const repeated = await saveResult(request)

  expect(repeated).toStrictEqual({ saved: true })
})

test(`a past year's results can't change`, async () => {
  const year = await addYear({ published: true })
  const request = await makeFirstResult(year)
  await addYear({ published: true })

  const saved = await saveResult(request)

  expect(saved).toStrictEqual({ refusal: `NOT_CURRENT_YEAR` })
})

test(`two results saved at once are both kept`, async () => {
  const year = await addYear({ published: true })
  const first = await makeFirstResult(year)
  const wildCard = await makeFirstResult(year, {
    round: `WILD_CARD`,
    index: 0,
  })

  await Promise.all([saveResult(first), saveResult(wildCard)])

  expect(Object.keys(await readResultRows(year)).toSorted()).toStrictEqual([
    `ROUND_1:0`,
    `WILD_CARD:0`,
  ])
})

test(`locking refuses new contests`, async () => {
  const year = await addYear({ published: true })
  await lockYear(year)

  const contest = await createContest(
    await createEducator(),
    `Period 2 Biology`,
  )

  expect(contest).toStrictEqual({ refusal: `LOCKED` })
})

test(`locking refuses new players`, async () => {
  const { contestId, year } = await createContestInNewYear()
  await lockYear(year)

  const player = await createPlayer(
    await readLinkSecret(contestId),
    `Maya R.`,
    () => Promise.resolve(undefined),
  )

  expect(player).toStrictEqual({ refusal: `NOT_OPEN` })
})

test.each([
  [`saving a draft`, (id: string) => savePlayerDraft(id, {})],
  [`submitting`, (id: string) => submitPlayerPicks(id, {})],
  [`discarding a draft`, (id: string) => discardPlayerDraft(id)],
])(`locking refuses %s`, async (_, write) => {
  const { playerId, year } = await createPlayerInNewYear()
  await lockYear(year)

  const result = await write(playerId)

  expect(result).toStrictEqual({ refusal: `NOT_OPEN` })
})

test(`a deleted player can't start again once locked`, async () => {
  const { contestId, year } = await createContestInNewYear()
  const { id, secret } = await addPlayer(contestId)
  const educatorId = await readEducatorId(contestId)
  await deletePlayers(educatorId, contestId, [id])
  await lockYear(year)

  const target = await readPersonalLink(secret)

  expect(target).toMatchObject({ startLinkSecret: null, isOpen: false })
})

test(`submissions reopen once every result is cleared`, async () => {
  const year = await addYear({ published: true })
  const request = await makeFirstResult(year)
  await saveResult(request)

  const early = await reopenSubmissions(year)
  await saveResult({
    ...request,
    winnerId: null,
    previousWinnerId: request.winnerId,
    locks: false,
  })
  const cleared = await readBracketSummary(year)
  const reopened = await reopenSubmissions(year)

  expect(early).toBe(`HAS_RESULTS`)
  expect(cleared).toMatchObject({ phase: `IN_PROGRESS`, hasResults: false })
  expect(reopened).toBe(`REOPENED`)
  await expect(
    addContest(await createEducator(), `Period 2 Biology`),
  ).resolves.toBeTypeOf(`string`)
})

test(`submissions that aren't locked don't reopen`, async () => {
  const year = await addYear({ published: true })

  await expect(reopenSubmissions(year)).resolves.toBe(`UNCHANGED`)
})

test(`a locked bracket stays published`, async () => {
  const year = await addYear({ published: true })
  await lockYear(year)

  await expect(setBracketPublished(year, false)).resolves.toBe(`LOCKED`)
})

test(`the champion completes the year and opens the next year's setup`, async () => {
  const year = await addYear({ published: true })
  const before = await readAdminYears()

  await crownChampion(year)

  expect(before).toMatchObject({ current: { year }, setupYear: null })
  const after = await readAdminYears()
  expect(after.current?.summary.phase).toBe(`COMPLETE`)
  expect(after.setupYear).toBeGreaterThan(year)
})

test(`publishing a newer bracket archives the year`, async () => {
  const year = await addYear({ published: true })
  await addYear({ published: true })

  await expect(readBracketSummary(year)).resolves.toMatchObject({
    phase: `ARCHIVED`,
  })
})

test(`a newer bracket is published only once the current year has a champion`, async () => {
  const year = await addYear({ published: true })
  const newerYear = await addYear({ published: false })

  const early = await setBracketPublished(newerYear, true)
  await crownChampion(year)
  const later = await setBracketPublished(newerYear, true)

  expect([early, later]).toStrictEqual([`NO_CHAMPION`, `CHANGED`])
})

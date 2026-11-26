import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { createEducator } from '../test/educators.ts'
import { addYear, setLocked } from '../test/years.ts'
import { prisma } from './db.server.ts'
import {
  readNameRemovalYear,
  removeExpiredNames,
} from './name-removal.server.ts'
import { saveReport } from './reports.server.ts'

test.each([
  { now: `2029-05-01T06:59:59Z`, year: 2026 },
  { now: `2029-05-01T07:00:00Z`, year: 2027 },
  { now: `2029-12-31T00:00:00Z`, year: 2027 },
  { now: `2030-01-01T07:00:00Z`, year: 2027 },
])(`on $now, names go through $year`, ({ now, year }) => {
  expect(readNameRemovalYear(new Date(now))).toBe(year)
})

test(`the job removes only expired names, and once`, async () => {
  const educatorId = await createEducator()
  const expiredYear = await addYear({ published: true })
  const { id: expiredId } = await addPlayer(
    await addContest(educatorId, `Expired`),
  )
  await setLocked(expiredYear)
  const keptYear = await addYear({ published: true })
  const { id: keptId } = await addPlayer(await addContest(educatorId, `Kept`))
  await setLocked(keptYear)
  const now = new Date(Date.UTC(expiredYear + 2, 5))

  await expect(removeExpiredNames(now)).resolves.toBeGreaterThanOrEqual(1)

  const players = await prisma.player.findMany({
    where: { id: { in: [expiredId, keptId] } },
    select: { id: true, displayName: true },
  })
  expect(
    new Map(players.map(({ id, displayName }) => [id, displayName])),
  ).toStrictEqual(
    new Map([
      [expiredId, `Player`],
      [keptId, `Maya R.`],
    ]),
  )
  await expect(removeExpiredNames(now)).resolves.toBe(0)
})

test(`an open year keeps its names however old it is`, async () => {
  const year = await addYear({ published: true })
  const { id } = await addPlayer(
    await addContest(await createEducator(), `Open`),
  )

  await removeExpiredNames(new Date(Date.UTC(year + 5, 5)))

  await expect(
    prisma.player.findUnique({ where: { id }, select: { displayName: true } }),
  ).resolves.toStrictEqual({ displayName: `Maya R.` })
})

test(`a report of a removed name goes with it`, async () => {
  const year = await addYear({ published: true })
  const contestId = await addContest(await createEducator(), `Reported`)
  const { id: playerId } = await addPlayer(contestId)
  await saveReport({ contestId, playerId, reason: `FULL_NAME` })
  await setLocked(year)

  await removeExpiredNames(new Date(Date.UTC(year + 2, 5)))

  await expect(prisma.report.count({ where: { playerId } })).resolves.toBe(0)
})

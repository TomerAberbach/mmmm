import { expect, test } from 'vitest'
import { addContest, addPlayer } from '../prisma/fixtures.ts'
import { createEducator } from '../test/educators.ts'
import { addYear } from '../test/years.ts'
import { prisma } from './db.server.ts'
import {
  countReports,
  dismissReport,
  readReports,
  saveReport,
} from './reports.server.ts'
import type { ReportReader } from './reports.server.ts'
import { deleteContest, deletePlayers } from './trash.server.ts'

const ADMIN: ReportReader = { kind: `admin` }

/** A report of a player, with the readers and the contest */
const createPlayerReport = async () => {
  await prisma.report.deleteMany()
  await addYear({ published: true })
  const educatorId = await createEducator()
  const contestId = await addContest(educatorId, `Period 2 Biology`)
  const { id: playerId } = await addPlayer(contestId, `Ninja Cat`)
  const report = { contestId, playerId, reason: `RUDE` } as const
  await saveReport(report)
  const reader: ReportReader = { kind: `educator`, educatorId }
  return { educatorId, contestId, playerId, report, reader }
}

const readOnly = async (reader: ReportReader) => {
  const { reports } = await readReports(reader, 1)
  expect(reports).toHaveLength(1)
  return reports[0]!
}

test(`a report reaches the contest's educator and the admin`, async () => {
  const { contestId, playerId, reader } = await createPlayerReport()

  const report = await readOnly(reader)

  expect(report).toMatchObject({
    contest: { id: contestId, name: `Period 2 Biology` },
    educatorName: `Ms. Frizzle`,
    player: { id: playerId, displayName: `Ninja Cat` },
    reason: `RUDE`,
  })
  await expect(readOnly(ADMIN)).resolves.toStrictEqual(report)
})

test(`another educator doesn't read it`, async () => {
  await createPlayerReport()
  const other: ReportReader = {
    kind: `educator`,
    educatorId: await createEducator(),
  }

  await expect(countReports(other)).resolves.toBe(0)
  const { id } = await readOnly(ADMIN)
  await expect(dismissReport(other, id)).resolves.toBe(false)
})

test(`the same report counts once until someone dismisses it`, async () => {
  const { report, reader } = await createPlayerReport()

  await saveReport(report)
  await expect(countReports(reader)).resolves.toBe(1)

  await dismissReport(reader, (await readOnly(reader)).id)
  await saveReport(report)
  await expect(countReports(reader)).resolves.toBe(1)
})

test(`the educator and the admin dismiss separately`, async () => {
  const { reader } = await createPlayerReport()
  const { id } = await readOnly(reader)

  await expect(dismissReport(reader, id)).resolves.toBe(true)

  await expect(countReports(reader)).resolves.toBe(0)
  await expect(countReports(ADMIN)).resolves.toBe(1)
  await expect(dismissReport(reader, id)).resolves.toBe(false)
})

test(`a report of a deleted player waits for its restore`, async () => {
  const { educatorId, contestId, playerId, reader } = await createPlayerReport()

  await deletePlayers(educatorId, contestId, [playerId])

  await expect(countReports(reader)).resolves.toBe(0)
})

test(`a report of a deleted contest's name waits for its restore`, async () => {
  const { educatorId, contestId, reader } = await createPlayerReport()
  await saveReport({ contestId, playerId: null, reason: `OTHER` })

  await deleteContest(educatorId, contestId)

  await expect(countReports(reader)).resolves.toBe(0)
  await expect(countReports(ADMIN)).resolves.toBe(0)
})

test(`a report of an erased player isn't saved`, async () => {
  const { report } = await createPlayerReport()
  await prisma.player.delete({ where: { id: report.playerId } })

  await expect(saveReport(report)).resolves.toBe(false)
})

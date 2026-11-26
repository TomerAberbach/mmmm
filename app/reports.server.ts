import { prisma } from './db.server.ts'
import { Prisma } from './generated/prisma/client.ts'
import type { ReportReason } from './generated/prisma/client.ts'
import { CONTEST_OUTSIDE_TRASH } from './outside-trash.server.ts'
import { countRowsBefore, PAGE_SIZE, toPageNumber } from './page-number.ts'
import type { PageNumber } from './page-number.ts'

/** `playerId` is null for a report of the contest's name */
type NewReport = {
  contestId: string
  playerId: string | null
  reason: ReportReason
}

/**
 * Saves the report. The same one again reaches a reader only after they dismiss
 * the first. Reports don't record who sent them. Returns whether what it's about
 * still exists
 */
export const saveReport = async (report: NewReport): Promise<boolean> => {
  const id = [report.contestId, report.playerId, report.reason].join(`:`)
  try {
    await prisma.report.upsert({
      where: { id },
      create: { id, ...report },
      update: {
        createdAt: new Date(),
        isDismissedByEducator: false,
        isDismissedByAdmin: false,
      },
    })
    return true
  } catch (error) {
    if (isMissingReference(error)) {
      return false
    }
    throw error
  }
}

const isMissingReference = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === `P2003`

/** Who reads a report. Each dismisses it separately */
export type ReportReader =
  { kind: `educator`; educatorId: string } | { kind: `admin` }

export type ReportItem = {
  id: string
  contest: { id: string; name: string; year: number }
  /** Null for an orphaned contest */
  educatorName: string | null
  /** Null for a report of the contest's name */
  player: { id: string; displayName: string } | null
  reason: ReportReason
  createdAt: Date
}

/** Newest first */
export const readReports = async (
  reader: ReportReader,
  page: number,
): Promise<{ reports: ReportItem[]; page: PageNumber }> => {
  const where = toRead(reader)
  const pageNumber = toPageNumber(page, await prisma.report.count({ where }))
  const reports = await prisma.report.findMany({
    where,
    orderBy: [{ createdAt: `desc` }, { id: `asc` }],
    skip: countRowsBefore(pageNumber),
    take: PAGE_SIZE,
    select: {
      id: true,
      reason: true,
      createdAt: true,
      player: { select: { id: true, displayName: true } },
      contest: {
        select: {
          id: true,
          name: true,
          year: true,
          educator: { select: { name: true } },
        },
      },
    },
  })
  return {
    reports: reports.map(
      ({ contest: { educator, ...contest }, ...report }) => ({
        ...report,
        contest,
        educatorName: educator?.name ?? null,
      }),
    ),
    page: pageNumber,
  }
}

export const countReports = (reader: ReportReader): Promise<number> =>
  prisma.report.count({ where: toRead(reader) })

/** Returns whether the reader had the report to read */
export const dismissReport = async (
  reader: ReportReader,
  reportId: string,
): Promise<boolean> => {
  const { count } = await prisma.report.updateMany({
    where: { ...toRead(reader), id: reportId },
    data:
      reader.kind === `admin`
        ? { isDismissedByAdmin: true }
        : { isDismissedByEducator: true },
  })
  return count > 0
}

/** Matches reports the reader hasn't dismissed, on what's outside the trash */
const toRead = (reader: ReportReader): Prisma.ReportWhereInput => ({
  OR: [{ playerId: null }, { player: { deletedAt: null } }],
  ...(reader.kind === `admin`
    ? { isDismissedByAdmin: false, contest: CONTEST_OUTSIDE_TRASH }
    : {
        isDismissedByEducator: false,
        contest: { educatorId: reader.educatorId, ...CONTEST_OUTSIDE_TRASH },
      }),
})

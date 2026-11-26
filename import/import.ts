import { emailSchema } from '../app/auth-forms.ts'
import { bracketInputSchema } from '../app/bracket-input.ts'
import type { BracketInput, CombatantPlace } from '../app/bracket-input.ts'
import { toSeedSlotKey } from '../app/bracket.ts'
import {
  insertBracket,
  lockYears,
  readBracketRows,
} from '../app/brackets.server.ts'
import { prisma } from '../app/db.server.ts'
import { freeAddress } from '../app/educator-deletion.server.ts'
import { CONTEST_NAME, DISPLAY_NAME } from '../app/free-text.ts'
import type { Prisma } from '../app/generated/prisma/client.ts'
import { UNNAMED_PLAYER } from '../app/leaderboard-row.ts'
import { normalizeEmail } from '../app/limits.server.ts'
import { lockPlayers } from '../app/lock-players.server.ts'
import { readNameRemovalYear } from '../app/name-removal.server.ts'
import { ensureOrganization } from '../app/organizations.server.ts'
import { storeScores } from '../app/scores.server.ts'
import { createSecret, hashSecret } from '../app/secrets.server.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import type { SeededBracket } from '../app/seeded-bracket.ts'
import type {
  OldBracket,
  OldClass,
  OldData,
  OldSubmission,
} from './old-data.ts'
import {
  parseOldWinners,
  readOldWinners,
  toBracketInput,
} from './old-winners.ts'
import type { OldWinners } from './old-winners.ts'

export type ImportReport = {
  imported: Record<
    `brackets` | `educators` | `contests` | `submissions`,
    number
  >
  /** Rows left out, by why, each with its ID in mmmm-old */
  skipped: Record<string, string[]>
  /** Rows imported with a change, by what changed */
  changed: Record<string, string[]>
}

/**
 * Replaces what an earlier import added with mmmm-old's data, and leaves
 * everything else as it is. Keeps mmmm-old's IDs, which makes it safe to rerun
 * until an imported educator is emailed or confirms their address.
 * A dry run changes nothing
 */
export const importOldData = async (
  data: OldData,
  { isDryRun, now }: { isDryRun: boolean; now: Date },
): Promise<ImportReport> => {
  const report: ImportReport = {
    imported: { brackets: 0, educators: 0, contests: 0, submissions: 0 },
    skipped: {},
    changed: {},
  }
  try {
    await prisma.$transaction(
      async tx => {
        await importInTransaction(tx, data, report, now)
        if (isDryRun) {
          throw new DryRunError()
        }
      },
      { timeout: 60 * 60 * 1000, maxWait: 5000 },
    )
  } catch (error) {
    if (!(error instanceof DryRunError)) {
      throw error
    }
  }
  return report
}

/** Rolls back the transaction */
class DryRunError extends Error {
  public override readonly name = `DryRunError`
}

const importInTransaction = async (
  tx: Prisma.TransactionClient,
  data: OldData,
  report: ImportReport,
  now: Date,
): Promise<void> => {
  // The import changes which years exist, are current, and are locked
  await lockYears(tx, `UPDATE`)
  await lockPlayers(tx)
  await refuseOnceInUse(tx, data)
  await removeEarlierImport(tx, data)
  const educatorIds = await importEducators(tx, data, report)
  const submissionsByClass = Map.groupBy(
    data.submissions,
    ({ classId }) => classId,
  )
  for (const bracket of data.brackets) {
    const year = await importBracket(tx, bracket, report)
    const classes = data.classes.filter(
      ({ bracketYear }) => bracketYear === bracket.year,
    )
    if (!year) {
      note(
        report.skipped,
        `contest of a skipped bracket`,
        ...classes.map(readId),
      )
      note(
        report.skipped,
        `submission of a skipped contest`,
        ...classes.flatMap(({ id }) =>
          (submissionsByClass.get(id) ?? []).map(readId),
        ),
      )
      continue
    }
    for (const oldClass of classes) {
      const submissions = submissionsByClass.get(oldClass.id) ?? []
      const educatorId = educatorIds.get(oldClass.teacherId)
      if (educatorId === undefined) {
        note(report.skipped, `contest of a skipped educator`, oldClass.id)
        note(
          report.skipped,
          `submission of a skipped contest`,
          ...submissions.map(readId),
        )
        continue
      }
      await importContest(tx, oldClass, educatorId, report)
      await importSubmissions(tx, submissions, year, report, now)
    }
    await storeScores(
      tx,
      bracket.year,
      year.bracket,
      year.battleIdByKey,
      year.results,
    )
  }
}

const readId = ({ id }: { id: string }): string => id

const note = (
  notes: Record<string, string[]>,
  reason: string,
  ...ids: string[]
): void => {
  if (ids.length > 0) {
    ;(notes[reason] ??= []).push(...ids)
  }
}

/**
 * Once an imported educator has confirmed their address, a rerun would undo what
 * they changed, and bring back what they deleted. Once one has been emailed, it
 * would email them again
 */
const refuseOnceInUse = async (
  tx: Prisma.TransactionClient,
  { teachers }: OldData,
): Promise<void> => {
  const count = await tx.educator.count({
    where: {
      id: { in: teachers.map(readId) },
      OR: [{ emailVerified: true }, { launchEmailedAt: { not: null } }],
    },
  })
  if (count > 0) {
    throw new Error(
      `${count} imported educators have been emailed or have confirmed, so the import can't rerun`,
    )
  }
}

/**
 * Keeps every contest of a year that has contests of its own, since the import
 * skips the year
 */
const removeEarlierImport = async (
  tx: Prisma.TransactionClient,
  { brackets, classes, teachers }: OldData,
): Promise<void> => {
  const classIds = classes.map(readId)
  const ownContests = await tx.contest.findMany({
    where: {
      year: { in: brackets.map(({ year }) => year) },
      id: { notIn: classIds },
    },
    distinct: [`year`],
    select: { year: true },
  })
  await tx.contest.deleteMany({
    where: {
      id: { in: classIds },
      year: { notIn: ownContests.map(({ year }) => year) },
    },
  })
  await tx.bracket.deleteMany({
    where: {
      // An imported bracket has its creation time from mmmm-old, which tells it
      // apart from one an admin set up
      OR: brackets.map(({ year, createdAt }) => ({ year, createdAt })),
      contests: { none: {} },
    },
  })
  await tx.educator.deleteMany({
    where: {
      id: { in: teachers.map(readId) },
      contests: { none: {} },
    },
  })
}

/** Mmmm-old has no educator names, and players see this one */
const IMPORTED_EDUCATOR_NAME = `Educator`

/** Each teacher's educator ID, for the teachers it imports */
const importEducators = async (
  tx: Prisma.TransactionClient,
  { teachers }: OldData,
  report: ImportReport,
): Promise<Map<string, string>> => {
  const educatorIds = new Map<string, string>()
  const importedIds = new Set<string>()
  for (const { id, email: rawEmail, createdAt } of teachers) {
    const email = normalizeEmail(rawEmail)
    if (!emailSchema.safeParse(email).success) {
      note(report.skipped, `educator whose email address is invalid`, id)
      continue
    }
    const existing = await findEducator(tx, id, email, importedIds)
    if (existing) {
      note(report.changed, `educator who already has an account`, id)
      educatorIds.set(id, existing.id)
      continue
    }
    await tx.educator.create({
      data: { id, name: IMPORTED_EDUCATOR_NAME, email, createdAt },
    })
    // So the admin can delete a school's data before its educators sign in
    await ensureOrganization(email, tx)
    educatorIds.set(id, id)
    importedIds.add(id)
    report.imported.educators++
  }
  return educatorIds
}

/**
 * The teacher's educator, if they have one. Looks for mmmm-old's ID first, since
 * a confirmed educator can change their address
 */
const findEducator = async (
  tx: Prisma.TransactionClient,
  id: string,
  email: string,
  importedIds: ReadonlySet<string>,
): Promise<{ id: string } | null> => {
  const select = { id: true }
  const byId = await tx.educator.findUnique({ where: { id }, select })
  if (byId) {
    return byId
  }
  const byEmail = await tx.educator.findUnique({ where: { email }, select })
  // Whoever signed up with an address they haven't confirmed may not own it, so
  // their password must not reach the teacher's contests
  const isReplaced =
    byEmail && !importedIds.has(byEmail.id) && (await freeAddress(email, tx))
  return isReplaced ? null : byEmail
}

type ImportedYear = {
  year: number
  bracket: SeededBracket
  battleIdByKey: ReadonlyMap<string, string>
  results: Record<string, string>
  /** For finding submissions whose combatants differ */
  combatants: OldWinners
}

/** Null for a bracket it skips */
const importBracket = async (
  tx: Prisma.TransactionClient,
  old: OldBracket,
  report: ImportReport,
): Promise<ImportedYear | null> => {
  const { year } = old
  const winners = parseOldWinners(old.winners)
  const input = winners && toBracketInput(readDivisionNames(old), winners)
  if (!winners || !input || !bracketInputSchema.safeParse(input).success) {
    note(report.skipped, `bracket whose combatants are invalid`, String(year))
    return null
  }
  if (
    await tx.bracket.findUnique({ where: { year }, select: { year: true } })
  ) {
    note(report.skipped, `bracket of a year that already has one`, String(year))
    return null
  }
  const imported = await insertImportedBracket(tx, old, input)
  const { winners: places, unknown } = readOldWinners(winners)
  if (unknown > 0) {
    note(report.changed, `bracket with unknown winners left out`, String(year))
  }
  const results = toCombatantIds(imported.bracket, places)
  await tx.result.createMany({
    data: Object.entries(results).map(([key, winnerId]) => ({
      battleId: imported.battleIdByKey.get(key)!,
      winnerId,
    })),
  })
  report.imported.brackets++
  return { year, ...imported, results, combatants: winners }
}

const readDivisionNames = ({
  topLeftDivision,
  bottomLeftDivision,
  topRightDivision,
  bottomRightDivision,
}: OldBracket): [string, string, string, string] => [
  topLeftDivision,
  bottomLeftDivision,
  topRightDivision,
  bottomRightDivision,
]

/** Published and locked, since mmmm-old's tournaments have started */
const insertImportedBracket = async (
  tx: Prisma.TransactionClient,
  { year, createdAt, updatedAt }: OldBracket,
  input: BracketInput,
) => {
  await insertBracket(tx, year, input)
  await tx.bracket.update({
    where: { year },
    data: { createdAt, publishedAt: createdAt, lockedAt: updatedAt },
  })
  const { bracket, battleIdByKey } = await readBracketRows(year, tx)
  return { bracket: toSeededBracket(bracket), battleIdByKey }
}

const toCombatantIds = (
  bracket: SeededBracket,
  places: Record<string, CombatantPlace>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(places).map(([key, place]) => [
      key,
      place.kind === `seedSlot`
        ? bracket.combatantBySeedSlot.get(toSeedSlotKey(place.seedSlot))!.id
        : bracket.wildCardEntrants[place.index]!.id,
    ]),
  )

const importContest = async (
  tx: Prisma.TransactionClient,
  { id, name, bracketYear, createdAt }: OldClass,
  educatorId: string,
  report: ImportReport,
): Promise<void> => {
  await tx.contest.create({
    data: {
      id,
      year: bracketYear,
      educatorId,
      name: fitName(name, CONTEST_NAME.maxLength, `Contest`, report, id),
      // No one holds it, and the contest takes no players
      linkSecret: createSecret(18),
      createdAt,
    },
  })
  report.imported.contests++
}

const fitName = (
  name: string,
  maxLength: number,
  fallback: string,
  report: ImportReport,
  id: string,
): string => {
  const trimmed = name.trim()
  const fitted =
    trimmed
      .slice(0, maxLength)
      // Half of a character that the limit cuts through, such as an emoji
      .replace(/\p{Surrogate}$/u, ``)
      .trim() || fallback
  if (fitted !== trimmed) {
    note(report.changed, `name shortened or filled in`, id)
  }
  return fitted
}

/** Each gets a personal link that no one holds, so it's view-only */
const importSubmissions = async (
  tx: Prisma.TransactionClient,
  submissions: OldSubmission[],
  year: ImportedYear,
  report: ImportReport,
  now: Date,
): Promise<void> => {
  const rows = submissions.flatMap(
    submission => toSubmissionRows(submission, year, report, now) ?? [],
  )
  await tx.player.createMany({ data: rows.map(({ player }) => player) })
  await tx.submission.createMany({
    data: rows.map(({ submission }) => submission),
  })
  const picks = rows.flatMap(row =>
    row.picks.map(pick => ({ playerId: row.player.id, ...pick })),
  )
  // One array for each column, since a row of parameters for each pick would
  // pass Postgres's limit
  await tx.$executeRaw`
    INSERT INTO "Pick" ("playerId", "stage", "battleId", "combatantId")
    SELECT "playerId", 'SUBMISSION', "battleId", "combatantId"
    FROM unnest(
      ${picks.map(({ playerId }) => playerId)}::text[],
      ${picks.map(({ battleId }) => battleId)}::text[],
      ${picks.map(({ combatantId }) => combatantId)}::text[]
    ) AS "Row" ("playerId", "battleId", "combatantId")
  `
  report.imported.submissions += rows.length
}

/** Null for a submission it skips */
const toSubmissionRows = (
  { id, name, approved, winners: json, classId, createdAt }: OldSubmission,
  { year, bracket, battleIdByKey, combatants }: ImportedYear,
  report: ImportReport,
  now: Date,
) => {
  const winners = parseOldWinners(json)
  if (!winners) {
    note(report.skipped, `submission whose picks are invalid`, id)
    return null
  }
  if (!hasSameCombatants(winners, combatants)) {
    note(report.skipped, `submission of other combatants`, id)
    return null
  }
  const { winners: places, unknown } = readOldWinners(winners)
  if (unknown > 0) {
    note(report.changed, `submission with unknown picks left out`, id)
  }
  return {
    player: {
      id,
      contestId: classId,
      displayName:
        year <= readNameRemovalYear(now)
          ? UNNAMED_PLAYER
          : fitName(name, DISPLAY_NAME.maxLength, UNNAMED_PLAYER, report, id),
      personalLinkHash: hashSecret(createSecret()),
      linkVersion: 1,
      createdAt,
    },
    submission: {
      playerId: id,
      status: approved ? (`APPROVED` as const) : (`PENDING` as const),
      createdAt,
      picksChangedAt: createdAt,
    },
    picks: Object.entries(toCombatantIds(bracket, places)).map(
      ([key, combatantId]) => ({
        battleId: battleIdByKey.get(key)!,
        combatantId,
      }),
    ),
  }
}

/** The wild card's winner, which comes first, can differ */
const hasSameCombatants = (
  winners: OldWinners,
  combatants: OldWinners,
): boolean =>
  combatants.slice(63).every((combatant, index) => {
    const other = winners[63 + index]
    return Array.isArray(combatant)
      ? Array.isArray(other) &&
          combatant
            .slice(1)
            .every((name, entrant) => other[entrant + 1] === name)
      : combatant === other
  })

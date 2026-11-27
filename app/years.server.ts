import { prisma } from './db.server.ts'
import type { Prisma } from './generated/prisma/client.ts'

/** The current year's bracket is the newest published one */
export const CURRENT_BRACKET = {
  where: { publishedAt: { not: null } },
  orderBy: { year: `desc` },
} satisfies Prisma.BracketFindFirstArgs

/** `isLocked` once the year's first result is saved, until the admin reopens */
export type CurrentYear = { year: number; isLocked: boolean }

/** Null before any bracket is published */
export const readCurrentYear = async (
  db: Prisma.TransactionClient = prisma,
): Promise<CurrentYear | null> => {
  const bracket = await db.bracket.findFirst({
    ...CURRENT_BRACKET,
    select: { year: true, lockedAt: true },
  })
  return bracket && { year: bracket.year, isLocked: bracket.lockedAt !== null }
}

/**
 * Only the current year takes new players, and only until it locks. Once it
 * stops, players can't submit or edit either
 */
export const isOpenYear = async (year: number): Promise<boolean> =>
  isOpen(await readCurrentYear(), year)

export const isOpen = (current: CurrentYear | null, year: number): boolean =>
  current?.year === year && !current.isLocked

/** Whether a newer year is current, so the year's results are final */
export const isPast = (current: CurrentYear | null, year: number): boolean =>
  current !== null && year < current.year

type CurrentYearChange<Result> = (
  tx: Prisma.TransactionClient,
  current: CurrentYear | null,
) => Promise<Result>

/**
 * Runs `change` in a transaction with the current year, which stays current,
 * and locked or not, until the transaction ends. Null before any bracket is
 * published. It locks the years before `change` can lock a row, so every
 * transaction takes its locks in one order
 */
export const withCurrentYear = <Result>(
  change: CurrentYearChange<Result>,
): Promise<Result> => withLockedYears(`SHARE`, change)

/**
 * Runs `change` as `withCurrentYear` does, alone, so it can change which year
 * is current or whether it's locked
 */
export const withCurrentYearAlone = <Result>(
  change: CurrentYearChange<Result>,
): Promise<Result> => withLockedYears(`UPDATE`, change)

const withLockedYears = <Result>(
  mode: LockMode,
  change: CurrentYearChange<Result>,
): Promise<Result> =>
  prisma.$transaction(async tx => {
    await lockYears(tx, mode)
    return change(tx, await readCurrentYear(tx))
  }, LOCKED_YEARS_LIMITS)

/**
 * Saving a result scores every submission of the year, and other changes wait for
 * it. `docs/load-test.md` has how long that takes
 */
export const LOCKED_YEARS_LIMITS = {
  timeout: 30_000,
  // Waiting changes can hold every connection. The pool itself waits 5 seconds
  maxWait: 5000,
}

type LockMode = `SHARE` | `UPDATE`

/**
 * Holds which years are published, current, and locked until the transaction
 * ends. Writes that depend on them take `SHARE`, which lets them run together,
 * and writes that change them take `UPDATE`. One advisory lock covers every
 * year, including a bracket inserted after the lock is taken
 */
export const lockYears = async (
  tx: Prisma.TransactionClient,
  mode: LockMode,
): Promise<void> => {
  await (mode === `SHARE`
    ? tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(${YEARS_LOCK_KEY})`
    : tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY})`)
}

/** An arbitrary key no other advisory lock in the app uses */
const YEARS_LOCK_KEY = 7_041_903

/**
 * Locks one year's bracket against other saves and changes to its expected lock
 * date until the transaction ends. Postgres keeps two-key advisory locks apart
 * from one-key ones, so it never waits on `lockYears`
 */
export const lockYearForSaving = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${YEARS_LOCK_KEY}::int, ${year}::int)`
}

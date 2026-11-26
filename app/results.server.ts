import { doesBattleExist, toBattleId, toBattleKey } from './bracket.ts'
import { readBracketRows, readResultRows } from './brackets.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { readArrangement } from './moves.ts'
import { returnClearedSubmissions } from './player-picks.server.ts'
import type { ResultRequest } from './result-request.ts'
import { applyResult, hasSameKeys } from './results.ts'
import type { Results } from './results.ts'
import { storeScores } from './scores.server.ts'
import { toSeededBracket } from './seeded-bracket.ts'
import type { SeededBracket, StoredMerge } from './seeded-bracket.ts'
import { withCurrentYearAlone } from './years.server.ts'

export type ResultRefusal = { refusal: `NOT_CURRENT_YEAR` | `STALE` }

/**
 * Saves the change with the scores it makes, and locks submissions, unless the
 * request's year isn't current or the change isn't what the admin saw and
 * confirmed. A repeated request whose change is already saved succeeds
 */
export const saveResult = (
  request: ResultRequest,
): Promise<{ saved: true } | ResultRefusal> =>
  withCurrentYearAlone(async (tx, current) => {
    const { year, battle, winnerId } = request
    if (current?.year !== year) {
      return { refusal: `NOT_CURRENT_YEAR` }
    }
    const stored = await readBracketRows(year, tx)
    if (
      !doesBattleExist(battle) ||
      readArrangement(stored) !== request.arrangement
    ) {
      return { refusal: `STALE` }
    }
    const key = toBattleKey(battle)
    const results = await readResultRows(year, tx)
    const present = results[key] ?? null
    if (present !== request.previousWinnerId) {
      return present === winnerId ? { saved: true } : { refusal: `STALE` }
    }
    const applied = applyResult(toSeededBracket(stored), results, request)
    if (!applied) {
      return { refusal: `STALE` }
    }
    if (
      !hasSameKeys(applied.change.cleared.map(toBattleKey), request.cleared) ||
      (!current.isLocked && !request.locks)
    ) {
      return { refusal: `STALE` }
    }
    await replaceResults(tx, year, {
      bracket: applied.bracket,
      results: applied.change.results,
      ...(applied.merge && { merge: applied.merge }),
    })
    if (!current.isLocked) {
      await tx.bracket.update({
        where: { year },
        data: { lockedAt: new Date() },
      })
    }
    return { saved: true }
  })

/**
 * Replaces the year's results, and stores the scores they make. A merge lasts
 * only while its result does
 */
const replaceResults = async (
  tx: Prisma.TransactionClient,
  year: number,
  {
    bracket,
    results,
    merge,
  }: {
    /** With `merge`, if any */
    bracket: SeededBracket
    results: Results
    /** A merge that the results record for the first time */
    merge?: StoredMerge
  },
): Promise<void> => {
  await tx.result.deleteMany({ where: { battle: { year } } })
  await tx.combatant.deleteMany({
    where: {
      year,
      members: { some: {} },
      id: { notIn: Object.values(results) },
    },
  })
  if (merge) {
    const { memberIds, ...combatant } = merge
    await tx.combatant.create({
      data: {
        ...combatant,
        year,
        members: { connect: memberIds.map(id => ({ id })) },
      },
    })
  }
  await tx.result.createMany({
    data: Object.entries(results).map(([key, winnerId]) => ({
      battleId: toBattleId(year, key),
      winnerId,
    })),
  })
  await storeScores(tx, year, bracket, results)
}

/** Clears the results, by battle key, of the year's bracket, if any */
export const clearResults = async (
  tx: Prisma.TransactionClient,
  year: number,
  bracket: SeededBracket,
  keys: ReadonlySet<string>,
): Promise<void> => {
  const entries = Object.entries(await readResultRows(year, tx))
  const kept = entries.filter(([key]) => !keys.has(key))
  if (kept.length < entries.length) {
    await replaceResults(tx, year, {
      bracket,
      results: Object.fromEntries(kept),
    })
  }
}

/**
 * Lets players submit and educators create contests again, once every result is
 * cleared. A submission that lost picks to a move since the lock returns to a
 * draft, as it would have before the lock. `UNCHANGED` means submissions aren't
 * locked
 */
export const reopenSubmissions = (
  year: number,
): Promise<`REOPENED` | `UNCHANGED` | `HAS_RESULTS`> =>
  withCurrentYearAlone(async (tx, current) => {
    if (current?.year !== year || !current.isLocked) {
      return `UNCHANGED`
    }
    if (await tx.result.findFirst({ where: { battle: { year } } })) {
      return `HAS_RESULTS`
    }
    await returnClearedSubmissions(tx, year)
    await tx.bracket.update({ where: { year }, data: { lockedAt: null } })
    return `REOPENED`
  })

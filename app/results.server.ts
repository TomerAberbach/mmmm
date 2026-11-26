import { toBattleKey } from './bracket.ts'
import type { BattleRef } from './bracket.ts'
import {
  readBracketRows,
  readResultRows,
  withCurrentYearAlone,
} from './brackets.server.ts'
import type { Prisma } from './generated/prisma/client.ts'
import { isContender } from './picks.ts'
import type { ResultRequest } from './result-request.ts'
import {
  clearResult,
  isNameFree,
  readMergeMembers,
  recordMerge,
  recordResult,
} from './results.ts'
import type { Results, ResultsChange } from './results.ts'
import { storeScores } from './scores.server.ts'
import { toSeededBracket, withMerge } from './seeded-bracket.ts'
import type { SeededBracket, StoredMerge } from './seeded-bracket.ts'

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
    const { bracket: stored, battleIdByKey } = await readBracketRows(year, tx)
    const key = toBattleKey(battle)
    const results = await readResultRows(year, tx)
    const battleId = battleIdByKey.get(key)
    if (battleId === undefined) {
      return { refusal: `STALE` }
    }
    const present = results[key] ?? null
    if (present !== request.previousWinnerId) {
      return present === winnerId ? { saved: true } : { refusal: `STALE` }
    }
    const applied = applyRequest(toSeededBracket(stored), results, request)
    if (!applied) {
      return { refusal: `STALE` }
    }
    if (
      !hasSameKeys(applied.change.cleared.map(toBattleKey), request.cleared) ||
      (!current.isLocked && !request.locks)
    ) {
      return { refusal: `STALE` }
    }
    await replaceResults(tx, year, battleIdByKey, applied)
    if (!current.isLocked) {
      await tx.bracket.update({
        where: { year },
        data: { lockedAt: new Date() },
      })
    }
    return { saved: true }
  })

type AppliedRequest = {
  /** With the merge the request records, if any */
  bracket: SeededBracket
  change: ResultsChange
  merge?: StoredMerge
}

/**
 * Replaces the year's results, and stores the scores they make. A merge lasts
 * only while its result does
 */
const replaceResults = async (
  tx: Prisma.TransactionClient,
  year: number,
  battleIdByKey: ReadonlyMap<string, string>,
  { bracket, change: { results }, merge }: AppliedRequest,
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
      battleId: battleIdByKey.get(key)!,
      winnerId,
    })),
  })
  await storeScores(tx, year, bracket, battleIdByKey, results)
}

/**
 * Null for a winner who can't win the battle, a clear without a result, or a
 * merge the battle or its name doesn't allow
 */
const applyRequest = (
  bracket: SeededBracket,
  results: Results,
  { battle, winnerId, mergeName }: ResultRequest,
): AppliedRequest | null => {
  if (winnerId === null) {
    return results[toBattleKey(battle)] === undefined
      ? null
      : { bracket, change: clearResult(bracket, results, battle) }
  }
  if (mergeName !== null) {
    const merge = buildMerge(bracket, results, battle, winnerId, mergeName)
    if (!merge) {
      return null
    }
    const merged = withMerge(bracket, merge)
    return {
      bracket: merged,
      change: recordMerge(results, battle, winnerId),
      merge,
    }
  }
  return isContender(bracket, battle, winnerId, results)
    ? { bracket, change: recordResult(bracket, results, battle, winnerId) }
    : null
}

const buildMerge = (
  bracket: SeededBracket,
  results: Results,
  battle: BattleRef,
  id: string,
  name: string,
): StoredMerge | null => {
  const memberIds = readMergeMembers(bracket, results, battle)
  return memberIds &&
    !bracket.combatantById.has(id) &&
    isNameFree(bracket, name)
    ? { id, name, memberIds }
    : null
}

const hasSameKeys = (keys: string[], otherKeys: string[]): boolean =>
  keys.length === otherKeys.length && keys.every(key => otherKeys.includes(key))

/**
 * Lets players submit and educators create contests again, once every result is
 * cleared. `UNCHANGED` means submissions aren't locked
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
    await tx.bracket.update({ where: { year }, data: { lockedAt: null } })
    return `REOPENED`
  })

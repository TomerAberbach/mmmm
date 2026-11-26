import { toBattleKey } from './bracket.ts'
import {
  readBracketRows,
  readResultRows,
  withCurrentYearAlone,
} from './brackets.server.ts'
import { isContender } from './picks.ts'
import type { ResultRequest } from './result-request.ts'
import { clearResult, recordResult } from './results.ts'
import type { Results, ResultsChange } from './results.ts'
import { toSeededBracket } from './seeded-bracket.ts'
import type { SeededBracket } from './seeded-bracket.ts'

export type ResultRefusal = { refusal: `NOT_CURRENT_YEAR` | `STALE` }

/**
 * Saves the change and locks submissions, unless the request's year isn't
 * current or the change isn't what the admin saw and confirmed. A repeated
 * request whose change is already saved succeeds
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
    const change = applyRequest(toSeededBracket(stored), results, request)
    if (
      !change ||
      !hasSameKeys(change.cleared.map(toBattleKey), request.cleared) ||
      (!current.isLocked && !request.locks)
    ) {
      return { refusal: `STALE` }
    }
    await tx.result.deleteMany({ where: { battle: { year } } })
    await tx.result.createMany({
      data: Object.entries(change.results).map(([resultKey, id]) => ({
        battleId: battleIdByKey.get(resultKey)!,
        winnerId: id,
      })),
    })
    if (!current.isLocked) {
      await tx.bracket.update({
        where: { year },
        data: { lockedAt: new Date() },
      })
    }
    return { saved: true }
  })

/** Null for a winner who can't win the battle, or a clear without a result */
const applyRequest = (
  bracket: SeededBracket,
  results: Results,
  { battle, winnerId }: ResultRequest,
): ResultsChange | null => {
  if (winnerId === null) {
    return results[toBattleKey(battle)] === undefined
      ? null
      : clearResult(bracket, results, battle)
  }
  return isContender(bracket, battle, winnerId, results)
    ? recordResult(bracket, results, battle, winnerId)
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

import { randomUUID } from 'node:crypto'
import type { BattleRef } from '../app/bracket.ts'
import { readBracket, readResultRows } from '../app/brackets.server.ts'
import { readArrangement } from '../app/moves.ts'
import { listContenders } from '../app/picks.ts'
import type { ResultRequest } from '../app/result-request.ts'
import { saveResult } from '../app/results.server.ts'
import { readMergeMembers } from '../app/results.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import type { SeededBracket } from '../app/seeded-bracket.ts'
import { CHAMPIONSHIP, ROUND_1_FIRST } from './picks.ts'

/** The year must have a bracket */
export const readSeededBracket = async (year: number): Promise<SeededBracket> =>
  toSeededBracket((await readBracket(year))!)

/** A confirmed request to record the first contender of the battle */
export const makeFirstResult = async (
  year: number,
  battle = ROUND_1_FIRST,
): Promise<ResultRequest> => {
  const stored = (await readBracket(year))!
  const bracket = toSeededBracket(stored)
  return {
    year,
    arrangement: readArrangement(stored),
    battle,
    winnerId: listContenders(bracket, battle)[0]!.id,
    merge: null,
    previousWinnerId: null,
    cleared: [],
    locks: true,
  }
}

/** A confirmed request to merge the battle's sides */
export const makeMerge = async (
  year: number,
  name = `Ginkgo & Rhizo`,
  battle = ROUND_1_FIRST,
): Promise<ResultRequest> => ({
  ...(await makeFirstResult(year, battle)),
  winnerId: randomUUID(),
  merge: {
    name,
    memberIds: readMergeMembers(
      await readSeededBracket(year),
      await readResultRows(year),
      battle,
    )!,
  },
})

const saveFirstResult = async (
  year: number,
  battle?: BattleRef,
): Promise<void> => {
  const saved = await saveResult(await makeFirstResult(year, battle))
  if (`refusal` in saved) {
    throw new Error(`The result was refused: ${saved.refusal}`)
  }
}

/** Saves the year's first result, which locks it */
export const lockYear = (year: number): Promise<void> => saveFirstResult(year)

/** Saves a champion, with their earlier wins, as the year's first result */
export const crownChampion = (year: number): Promise<void> =>
  saveFirstResult(year, CHAMPIONSHIP)

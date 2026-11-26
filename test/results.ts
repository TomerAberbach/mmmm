import type { BattleRef } from '../app/bracket.ts'
import { readBracket } from '../app/brackets.server.ts'
import { listContenders } from '../app/picks.ts'
import type { ResultRequest } from '../app/result-request.ts'
import { saveResult } from '../app/results.server.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import { CHAMPIONSHIP, ROUND_1_FIRST } from './picks.ts'

/** A confirmed request to record the first contender of the battle */
export const makeFirstResult = async (
  year: number,
  battle = ROUND_1_FIRST,
): Promise<ResultRequest> => {
  const bracket = toSeededBracket((await readBracket(year))!)
  return {
    year,
    battle,
    winnerId: listContenders(bracket, battle)[0]!.id,
    previousWinnerId: null,
    cleared: [],
    locks: true,
  }
}

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

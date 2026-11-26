import { setTimeout } from 'node:timers/promises'
import { listBattles, toBattleKey } from '../app/bracket.ts'
import { readBracket, readResultRows } from '../app/brackets.server.ts'
import { readArrangement } from '../app/moves.ts'
import { saveResult } from '../app/results.server.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import { listContenders } from '../app/winners.ts'
import { readCurrentYear } from '../app/years.server.ts'
import {
  PLAYERS_PER_CONTEST,
  toContestId,
  toPlayerSecret,
  YEAR,
} from './data.ts'
import { measure, printMeasurements } from './measure.ts'
import type { Measurements } from './measure.ts'
import { readCookie, send } from './server.ts'
import type { Client } from './server.ts'

/** How many players read pages at once while a result is saved */
const READING_PLAYERS = 60
const READING_SECONDS = 20

/** Players read their brackets and leaderboards while a result is saved */
export const runReading = async (): Promise<void> => {
  await saveNextResult()
  const before: Measurements = new Map()
  const during: Measurements = new Map()
  const state = { current: before, isDone: false }
  const readers = Array.from({ length: READING_PLAYERS }, async (_, index) => {
    const playerIndex = index * PLAYERS_PER_CONTEST
    const contest = toContestId(index)
    const stranger: Client = { ip: `198.51.100.${index + 1}`, cookie: `` }
    const opened = await send(
      stranger,
      `/my-bracket/${toPlayerSecret(playerIndex)}`,
    )
    const client: Client = { ...stranger, cookie: readCookie(opened) }
    while (!state.isDone) {
      for (const page of [
        `bracket`,
        `leaderboards/contest`,
        `leaderboards/organization`,
        `leaderboards/global`,
      ]) {
        const measurements = state.current
        await measure(measurements, page, () =>
          send(client, `/player/${contest}/${page}`),
        )
      }
    }
  })
  const reading = Promise.all(readers)
  let saves = 0
  let seconds = 0
  const saveResults = async (): Promise<void> => {
    try {
      await setTimeout(READING_SECONDS * 500)
      state.current = during
      const start = performance.now()
      const end = Date.now() + READING_SECONDS * 500
      while (Date.now() < end) {
        await saveNextResult()
        saves++
      }
      seconds = (performance.now() - start) / 1000
    } finally {
      state.isDone = true
    }
  }
  await Promise.all([reading, saveResults()])
  printMeasurements(
    `${READING_PLAYERS} players read pages as fast as they can`,
    before,
    READING_SECONDS / 2,
  )
  printMeasurements(
    `The same while results save (${(seconds / saves).toFixed(1)} s each, one after another)`,
    during,
    seconds,
  )
}

/** Saves the first undecided battle's first side as its winner */
const saveNextResult = async (): Promise<void> => {
  const stored = (await readBracket(YEAR))!
  const results = await readResultRows(YEAR)
  const battle = listBattles().find(
    candidate => results[toBattleKey(candidate)] === undefined,
  )!
  const current = (await readCurrentYear())!
  const saved = await saveResult({
    year: YEAR,
    battle,
    winnerId: listContenders(toSeededBracket(stored), battle, results)[0]!.id,
    previousWinnerId: null,
    merge: null,
    cleared: [],
    locks: !current.isLocked,
    arrangement: readArrangement(stored),
  })
  if (`refusal` in saved) {
    throw new Error(`The result was refused: ${saved.refusal}`)
  }
}

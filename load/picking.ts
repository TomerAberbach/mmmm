import { setTimeout } from 'node:timers/promises'
import { listBattles } from '../app/bracket.ts'
import { readBracket } from '../app/brackets.server.ts'
import { readArrangement } from '../app/moves.ts'
import type { Picks } from '../app/picks.ts'
import { toSeededBracket } from '../app/seeded-bracket.ts'
import { listContenders, setWinner } from '../app/winners.ts'
import { toContestId, toLinkSecret, YEAR } from './data.ts'
import { measure, printMeasurements } from './measure.ts'
import type { Measurements } from './measure.ts'
import { readCookie, send } from './server.ts'
import type { Client } from './server.ts'

/** How many players pick at once from one IP address */
const PICKING_PLAYERS = 200
const PICKING_SECONDS = 30
/** Between one player's picks */
const THINK_MS = 3000

/** One school: many players start and pick at once from one IP address */
export const runPicking = async (): Promise<void> => {
  const measurements: Measurements = new Map()
  const end = Date.now() + PICKING_SECONDS * 1000
  const { arrangement, drafts } = await planPicks()
  await Promise.all(
    Array.from({ length: PICKING_PLAYERS }, async (_, index) => {
      const contest = index % 8
      await setTimeout(Math.random() * THINK_MS)
      const stranger: Client = { ip: `203.0.113.1`, cookie: `` }
      await measure(measurements, `contest link`, () =>
        send(stranger, `/play/${toLinkSecret(contest)}`),
      )
      const started = await measure(measurements, `start`, () =>
        send(stranger, `/play/${toLinkSecret(contest)}?index`, {
          method: `POST`,
          body: new URLSearchParams({ displayName: `Player ${index}` }),
        }),
      )
      if (started.status !== 302) {
        return
      }
      const client: Client = { ...stranger, cookie: readCookie(started) }
      const path = `/player/${toContestId(contest)}/bracket`
      await measure(measurements, `bracket page`, () => send(client, path))
      for (const picks of drafts) {
        if (Date.now() >= end) {
          break
        }
        await setTimeout(THINK_MS)
        await measure(measurements, `autosave`, () =>
          send(client, `${path}/picks`, {
            method: `POST`,
            headers: { 'content-type': `application/json` },
            body: JSON.stringify({ intent: `save`, picks, arrangement }),
          }),
        )
      }
    }),
  )
  printMeasurements(
    `${PICKING_PLAYERS} players pick from one IP address`,
    measurements,
    PICKING_SECONDS,
  )
}

/** The draft after each of a player's picks, in the order of the battles */
const planPicks = async (): Promise<{
  arrangement: string
  drafts: Picks[]
}> => {
  const stored = (await readBracket(YEAR))!
  const bracket = toSeededBracket(stored)
  const drafts: Picks[] = []
  for (const battle of listBattles()) {
    const picks = drafts.at(-1) ?? {}
    const [winner] = listContenders(bracket, battle, picks)
    drafts.push(setWinner(bracket, picks, battle, winner!.id).winners)
  }
  return { arrangement: readArrangement(stored), drafts }
}

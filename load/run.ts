import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout } from 'node:timers/promises'
import type { Picks } from '../app/picks.ts'
import { createTestDatabase } from '../test/database.ts'
import type { Measurements } from './measure.ts'
import { measure, printMeasurements } from './measure.ts'

const PORT = 3018
const ORIGIN = `http://localhost:${PORT}`

/** How many players pick at once from one IP address */
const PICKING_PLAYERS = 200
const PICKING_SECONDS = 30
/** Between one player's picks */
const THINK_MS = 3000

/** How many players read pages at once while a result is saved */
const READING_PLAYERS = 60
const READING_SECONDS = 20

// Express logs that it's listening even when the port is taken
if (await fetch(ORIGIN).catch(() => null)) {
  throw new Error(`Stop the server on port ${PORT} first`)
}
const database = await createTestDatabase()
process.env.DATABASE_URL = database.url
const {
  fillDatabase,
  PLAYERS_PER_CONTEST,
  toContestId,
  toLinkSecret,
  toPlayerSecret,
  YEAR,
} = await import(`./data.ts`)
const { prisma } = await import(`../app/db.server.ts`)

const spawnServer = (): ChildProcess =>
  spawn(`node`, [`server.ts`], {
    env: {
      ...process.env,
      NODE_ENV: `production`,
      PORT: String(PORT),
      BETTER_AUTH_SECRET: `load-secret-that-is-at-least-32-characters`,
      BETTER_AUTH_URL: ORIGIN,
      SUPPORT_EMAIL: `support@example.com`,
      APP_ENV: `test`,
      EMAIL_TRANSPORT: `mailbox`,
      EMAIL_FROM: `MMMM <noreply@example.com>`,
      // Trusts X-Forwarded-For, so players can have their own IP addresses
      FLY_APP_NAME: `load`,
    },
    stdio: [`ignore`, `ignore`, `inherit`],
  })

const hasExited = ({ exitCode, signalCode }: ChildProcess): boolean =>
  exitCode !== null || signalCode !== null

/** Throws if the server exits first */
const waitUntilReady = async (server: ChildProcess): Promise<void> => {
  for (;;) {
    if (hasExited(server)) {
      throw new Error(`The server exited before it was ready`)
    }
    const response = await fetch(`${ORIGIN}/healthz`).catch(() => null)
    if (response?.ok) {
      return
    }
    await setTimeout(200)
  }
}

const stopServer = async (server: ChildProcess): Promise<void> => {
  if (!hasExited(server)) {
    const exited = once(server, `exit`)
    server.kill()
    await exited
  }
}

type Client = { ip: string; cookie: string }

const send = (
  { ip, cookie }: Client,
  path: string,
  {
    headers,
    ...init
  }: Omit<RequestInit, `headers`> & { headers?: Record<string, string> } = {},
): Promise<Response> =>
  fetch(`${ORIGIN}${path}`, {
    redirect: `manual`,
    ...init,
    headers: {
      ...headers,
      cookie,
      origin: ORIGIN,
      'sec-fetch-site': `same-origin`,
      'x-forwarded-for': ip,
    },
  })

const readCookie = (response: Response): string =>
  response.headers.get(`set-cookie`)!.split(`;`)[0]!

/** One school: many players start and pick at once from one IP address */
const runPicking = async (): Promise<void> => {
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
  const { readBracket } = await import(`../app/brackets.server.ts`)
  const { listBattles } = await import(`../app/bracket.ts`)
  const { readArrangement } = await import(`../app/moves.ts`)
  const { listContenders, pickWinner } = await import(`../app/picks.ts`)
  const { toSeededBracket } = await import(`../app/seeded-bracket.ts`)
  const stored = (await readBracket(YEAR))!
  const bracket = toSeededBracket(stored)
  const drafts: Picks[] = []
  for (const battle of listBattles()) {
    const picks = drafts.at(-1) ?? {}
    const [winner] = listContenders(bracket, battle, picks)
    drafts.push(pickWinner(bracket, picks, battle, winner!.id).picks)
  }
  return { arrangement: readArrangement(stored), drafts }
}

/** Players read their brackets and leaderboards while a result is saved */
const runReading = async (): Promise<void> => {
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
  const { readBracket, readResultRows } = await import(
    `../app/brackets.server.ts`
  )
  const { readCurrentYear } = await import(`../app/years.server.ts`)
  const { listBattles, toBattleKey } = await import(`../app/bracket.ts`)
  const { readArrangement } = await import(`../app/moves.ts`)
  const { listContenders } = await import(`../app/picks.ts`)
  const { saveResult } = await import(`../app/results.server.ts`)
  const { toSeededBracket } = await import(`../app/seeded-bracket.ts`)
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

let server: ChildProcess | undefined
const dropAndExit = (): void => {
  server?.kill()
  void database.drop().then(() => process.exit(1))
}
process.once(`SIGTERM`, dropAndExit)
process.once(`SIGINT`, dropAndExit)

try {
  await fillDatabase()
  server = spawnServer()
  await waitUntilReady(server)
  await runPicking()
  await runReading()
} finally {
  if (server) {
    await stopServer(server)
  }
  await prisma.$disconnect()
  await database.drop()
}

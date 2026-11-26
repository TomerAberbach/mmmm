import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout } from 'node:timers/promises'

const PORT = 3018
const ORIGIN = `http://localhost:${PORT}`

/** Express logs that it's listening even when the port is taken */
export const requireFreePort = async (): Promise<void> => {
  if (await fetch(ORIGIN).catch(() => null)) {
    throw new Error(`Stop the server on port ${PORT} first`)
  }
}

export const spawnServer = (): ChildProcess =>
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
export const waitUntilReady = async (server: ChildProcess): Promise<void> => {
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

export const stopServer = async (server: ChildProcess): Promise<void> => {
  if (!hasExited(server)) {
    const exited = once(server, `exit`)
    server.kill()
    await exited
  }
}

export type Client = { ip: string; cookie: string }

const APP_IP = `198.18.0.1`

export const send = (
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
      // As Fly's proxy sends it, the app's own address last
      'x-forwarded-for': `${ip}, ${APP_IP}`,
    },
  })

export const readCookie = (response: Response): string =>
  response.headers.get(`set-cookie`)!.split(`;`)[0]!

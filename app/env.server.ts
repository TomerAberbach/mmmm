import { existsSync } from 'node:fs'
import { z } from 'zod'

// Variables already set take precedence over `.env`
if (existsSync(`.env`)) {
  process.loadEnvFile()
}

export const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Set ${name} in .env, as in .env.example`)
  }
  return value
}

// True only under `pnpm dev`, which serves the app through Vite
export const isDevelopment = (): boolean =>
  process.env.NODE_ENV === `development`

export const toAppUrl = (path: string): URL =>
  new URL(path, requireEnv(`BETTER_AUTH_URL`))

// Better Auth marks its cookies `Secure` by the same check
export const isServedOverHttps = (): boolean =>
  toAppUrl(`/`).protocol === `https:`

const APP_ENVS = [`development`, `test`, `staging`, `production`] as const
export type AppEnv = (typeof APP_ENVS)[number]

export const readAppEnv = (): AppEnv => {
  const appEnv = z.enum(APP_ENVS).safeParse(requireEnv(`APP_ENV`))
  if (!appEnv.success) {
    throw new Error(`Set APP_ENV to one of: ${APP_ENVS.join(`, `)}`)
  }
  return appEnv.data
}

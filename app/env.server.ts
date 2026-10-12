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

const APP_ENVS = [`development`, `test`, `staging`, `production`] as const
export type AppEnv = (typeof APP_ENVS)[number]

export const readAppEnv = (): AppEnv => {
  const appEnv = z.enum(APP_ENVS).safeParse(requireEnv(`APP_ENV`))
  if (!appEnv.success) {
    throw new Error(`Set APP_ENV to one of: ${APP_ENVS.join(`, `)}`)
  }
  return appEnv.data
}

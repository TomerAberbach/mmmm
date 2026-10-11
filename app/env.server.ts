import { existsSync } from 'node:fs'

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

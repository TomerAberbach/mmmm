import { betterAuth } from 'better-auth'

const requireEnv = (name: string): string => {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Set ${name} in .env, as in .env.example`)
  }
  return value
}

export const auth = betterAuth({
  baseURL: requireEnv(`BETTER_AUTH_URL`),
  secret: requireEnv(`BETTER_AUTH_SECRET`),
  emailAndPassword: { enabled: true },
})

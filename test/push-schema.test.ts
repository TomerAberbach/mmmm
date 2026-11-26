import { expect, test } from 'vitest'
import { pushSchema } from '../prisma/push-schema.ts'

const push = (env: NodeJS.ProcessEnv) =>
  pushSchema({ forceReset: true, env: { ...process.env, ...env } })

test(`only staging's database on Fly can be emptied`, async () => {
  // Nothing listens here, so a missing check can't empty a database
  await expect(
    push({
      DATABASE_URL: `postgresql://localhost:1/none`,
      FLY_APP_NAME: `mmmm-production`,
    }),
  ).rejects.toThrow(`Refusing to change the database of mmmm-production`)
})

test(`a database on another computer can't be emptied`, async () => {
  await expect(
    push({ DATABASE_URL: `postgresql://database.invalid/none` }),
  ).rejects.toThrow(`Refusing to change a database on another computer`)
})

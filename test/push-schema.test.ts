import { expect, test } from 'vitest'
import { pushSchema } from '../prisma/push-schema.ts'

test(`only staging's database on Fly can be emptied`, async () => {
  // Nothing listens here, so a missing check can't empty a database
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://localhost:1/none`,
    FLY_APP_NAME: `mmmm-production`,
  }

  await expect(pushSchema({ forceReset: true, env })).rejects.toThrow(
    `Refusing to empty the database of mmmm-production`,
  )
})

import { expect, onTestFinished, test, vi } from 'vitest'
import { createPrismaClient, prisma } from './db.server.ts'
import { checkDatabase } from './health.server.ts'

test(`the database is up when it answers a query`, async () => {
  const health = await checkDatabase(prisma)

  expect(health).toBe(`up`)
})

test(`the database is down when it refuses connections`, async () => {
  vi.spyOn(console, `error`).mockImplementation(() => {})
  const unreachable = createPrismaClient(
    `postgresql://mmmm:mmmm@127.0.0.1:1/mmmm`,
  )
  onTestFinished(() => unreachable.$disconnect())

  const health = await checkDatabase(unreachable)

  expect(health).toBe(`down`)
})

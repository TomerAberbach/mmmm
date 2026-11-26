import { expect, vi } from 'vitest'
import { prisma } from '../app/db.server.ts'

/** Waits until a query waits for a lock in the test database */
export const waitForBlockedQuery = async (): Promise<void> => {
  await vi.waitFor(async () => {
    await expect(
      prisma.$queryRaw`
        SELECT 1 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
      `,
    ).resolves.toHaveLength(1)
  })
}

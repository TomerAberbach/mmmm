import { inject } from 'vitest'
import { ensureTemplateCopy } from './database.ts'

const poolId = process.env.VITEST_POOL_ID
if (poolId === undefined) {
  throw new Error(`Run the Node tests through Vitest`)
}
// Each worker has its own database, so the files in a worker run one after
// another against it, and never alongside a file in another worker
process.env.DATABASE_URL = await ensureTemplateCopy(
  inject(`templateDatabase`),
  poolId,
)

import { z } from 'zod'
import { TOTAL_BATTLES } from './picks.ts'

const picksSchema = z
  .record(z.string().max(40), z.string().max(200))
  .refine(picks => Object.keys(picks).length <= TOTAL_BATTLES)

export const picksRequestSchema = z.discriminatedUnion(`intent`, [
  z.object({ intent: z.literal(`save`), picks: picksSchema }),
  z.object({ intent: z.literal(`submit`), picks: picksSchema }),
  z.object({ intent: z.literal(`discard`) }),
])

export type PicksRequest = z.infer<typeof picksRequestSchema>

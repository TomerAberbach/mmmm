import { z } from 'zod'
import { TOTAL_BATTLES } from './winners.ts'

/** Battle keys mapped to combatant IDs */
const picksSchema = z
  .record(z.string().max(40), z.string().max(40))
  .refine(picks => Object.keys(picks).length <= TOTAL_BATTLES)

/** The arrangement of the bracket the player picked */
const arrangement = z.string()

export const picksRequestSchema = z.discriminatedUnion(`intent`, [
  z.object({ intent: z.literal(`save`), picks: picksSchema, arrangement }),
  z.object({ intent: z.literal(`submit`), picks: picksSchema, arrangement }),
  z.object({ intent: z.literal(`discard`) }),
])

export type PicksRequest = z.infer<typeof picksRequestSchema>

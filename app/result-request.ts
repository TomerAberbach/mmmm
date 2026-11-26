import { z } from 'zod'
import { freeTextSchema, MERGE_NAME } from './free-text.ts'
import { Round } from './generated/prisma/enums.ts'

const idSchema = z.string().max(40)

/**
 * A change to one battle's result. It holds what the admin saw and confirmed,
 * so the server refuses a change whose effects would differ
 */
export const resultRequestSchema = z.object({
  year: z.int(),
  arrangement: z.string(),
  battle: z.object({ round: z.enum(Round), index: z.int().min(0) }),
  /** The winner to record. Null clears the result */
  winnerId: idSchema.nullable(),
  /** The combined name of a merge to record, whose new ID is `winnerId` */
  mergeName: freeTextSchema(MERGE_NAME).nullable(),
  /** The battle's result before the change */
  previousWinnerId: idSchema.nullable(),
  /** The keys of the later battles whose results the change clears */
  cleared: z.array(idSchema),
  /** Whether the admin confirmed that the change locks submissions */
  locks: z.boolean(),
})

export type ResultRequest = z.infer<typeof resultRequestSchema>

import { z } from 'zod'

const idSchema = z.string().max(40)

/**
 * A move of combatants, to preview or to make. It holds the arrangement and the
 * lock the admin saw, so the server refuses a move whose effects would differ
 */
export const moveRequestSchema = z.object({
  intent: z.enum([`preview`, `save`]),
  year: z.int(),
  arrangement: z.string(),
  isLocked: z.boolean(),
  swaps: z.array(z.tuple([idSchema, idSchema])).min(1),
})

export type MoveRequest = z.infer<typeof moveRequestSchema>

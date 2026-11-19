import { z } from 'zod'
import { DISPLAY_NAME, PLAYER_NAME } from './free-text.ts'
import type { FreeTextSchema } from './free-text.ts'

export const displayNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ displayName: z.ZodString }> =>
  z.object({ displayName: text(DISPLAY_NAME) })

export const playerNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ displayName: z.ZodString }> =>
  z.object({ displayName: text(PLAYER_NAME) })

/**
 * An educator approves or rejects a submission. Nothing returns one to
 * pending
 */
export const submissionStatusSchema = z.object({
  status: z.enum([`APPROVED`, `REJECTED`]),
})

export type Decision = z.infer<typeof submissionStatusSchema>[`status`]

/** The pending submissions the educator saw, by player ID, comma-separated */
export const approvePendingSchema = z.object({
  playerIds: z
    .string()
    .transform(ids => ids.split(`,`).filter(id => id !== ``)),
})

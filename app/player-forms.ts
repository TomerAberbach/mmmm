import { z } from 'zod'
import { DISPLAY_NAME, PLAYER_NAME } from './free-text.ts'
import type { FreeTextSchema } from './free-text.ts'
import { idsSchema } from './id-list.ts'

export const displayNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ displayName: z.ZodString }> =>
  z.object({ displayName: text(DISPLAY_NAME) })

export const playerNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ displayName: z.ZodString }> =>
  z.object({ displayName: text(PLAYER_NAME) })

/**
 * An educator approves or rejects submissions, listed by player ID. Nothing
 * returns one to pending
 */
export const submissionStatusSchema = idsSchema.extend({
  status: z.enum([`APPROVED`, `REJECTED`]),
})

export type Decision = z.infer<typeof submissionStatusSchema>[`status`]

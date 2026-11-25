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

/** The players' IDs as a form field holds them */
export const joinPlayerIds = (players: { id: string }[]): string =>
  players.map(({ id }) => id).join(`,`)

const playerIdsSchema = z
  .string()
  .transform(ids => ids.split(`,`).filter(id => id !== ``))

/**
 * An educator approves or rejects submissions. Nothing returns one to pending
 */
export const submissionStatusSchema = z.object({
  playerIds: playerIdsSchema,
  status: z.enum([`APPROVED`, `REJECTED`]),
})

export type Decision = z.infer<typeof submissionStatusSchema>[`status`]

/** The players of the pending submissions the educator saw */
export const approvePendingSchema = z.object({ playerIds: playerIdsSchema })

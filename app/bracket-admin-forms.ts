import { z } from 'zod'
import { COMBATANT_NAME, freeTextSchema } from './free-text.ts'

/**
 * Admins copy names from ASU's bracket, so they skip the offensive word filter
 */
export const renameSchema = z.object({
  year: z.int(),
  combatantId: z.string(),
  name: freeTextSchema(COMBATANT_NAME),
})

/** A blank date clears it */
export const expectedLockDateSchema = z.object({
  year: z.int(),
  expectedLockDate: z.iso
    .date({ error: `Enter a date, such as March 19` })
    .optional(),
})

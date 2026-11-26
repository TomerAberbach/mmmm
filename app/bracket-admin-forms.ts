import { z } from 'zod'
import { DivisionPosition } from './bracket.ts'
import { COMBATANT_NAME, DIVISION_NAME, freeTextSchema } from './free-text.ts'

/**
 * Admins copy names from ASU's bracket, so they skip the offensive word filter
 */
export const renameSchema = z.object({
  year: z.int(),
  combatantId: z.string(),
  name: freeTextSchema(COMBATANT_NAME),
})

/** As with combatants' names */
export const divisionRenameSchema = z.object({
  year: z.int(),
  position: z.enum(DivisionPosition),
  name: freeTextSchema(DIVISION_NAME),
})

/** A blank date clears it */
export const expectedLockDateSchema = z.object({
  year: z.int(),
  expectedLockDate: z.iso
    .date({ error: `Enter a date, such as March 19` })
    .optional(),
})

import { z } from 'zod'
import { CONTEST_NAME } from './free-text.ts'
import type { FreeTextSchema } from './free-text.ts'

/** The contest's name, typed to confirm its erasure */
export const contestErasureSchema = z.object({
  confirmation: z.string({ error: `Type the contest’s name` }),
})

export const contestNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ name: z.ZodString }> => z.object({ name: text(CONTEST_NAME) })

import { z } from 'zod'
import { CONTEST_NAME } from './free-text.ts'
import type { FreeTextSchema } from './free-text.ts'

export const contestNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ name: z.ZodString }> => z.object({ name: text(CONTEST_NAME) })

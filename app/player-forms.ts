import { z } from 'zod'
import { DISPLAY_NAME } from './free-text.ts'
import type { FreeTextSchema } from './free-text.ts'

export const displayNameSchema = (
  text: FreeTextSchema,
): z.ZodObject<{ displayName: z.ZodString }> =>
  z.object({ displayName: text(DISPLAY_NAME) })

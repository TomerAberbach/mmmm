import { z } from 'zod'
import { DISPLAY_NAME, freeTextSchema } from './free-text.ts'

export const displayNameSchema = z.object({
  displayName: freeTextSchema(DISPLAY_NAME),
})

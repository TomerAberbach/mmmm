import { z } from 'zod'
import { CONTEST_NAME, freeTextSchema } from './free-text.ts'

export const contestNameSchema = z.object({
  name: freeTextSchema(CONTEST_NAME),
})

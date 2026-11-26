import { z } from 'zod'
import { emailSchema } from './auth-forms.ts'

export const addressSchema = z.object({ email: emailSchema })

export const organizationDeletionSchema = z.object({
  domain: z.string(),
  confirmation: z.string({ error: `Type the domain` }).trim().toLowerCase(),
})

/** The educator is named before the contest is theirs */
export const handOverSchema = z.object({
  contestId: z.string(),
  email: emailSchema,
  educatorId: z.string().optional(),
})

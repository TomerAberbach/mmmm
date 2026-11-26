import { z } from 'zod'
import { emailSchema } from './auth-forms.ts'

export const shareSchema = z.object({ email: emailSchema })

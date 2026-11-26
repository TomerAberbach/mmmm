import { z } from 'zod'
import { emailSchema } from './auth-forms.ts'

export const accountDeletionSchema = z.object({ email: emailSchema })

export const WRONG_ADDRESS_MESSAGE = `This isn’t the account’s email address`

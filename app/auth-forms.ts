import { z } from 'zod'
import { EDUCATOR_NAME, freeTextSchema } from './free-text.ts'

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128
export const CONFIRMATION_EXPIRES_IN_DAYS = 3

export const INVALID_EMAIL_MESSAGE = `Enter an email address like name@school.org`
const SHORT_PASSWORD_MESSAGE = `Enter a password of at least ${MIN_PASSWORD_LENGTH} characters`

export const emailSchema = z
  .email({ error: INVALID_EMAIL_MESSAGE })
  .max(254, INVALID_EMAIL_MESSAGE)

export const signUpSchema = z.object({
  name: freeTextSchema(EDUCATOR_NAME),
  email: emailSchema,
  password: z
    .string({ error: SHORT_PASSWORD_MESSAGE })
    .min(MIN_PASSWORD_LENGTH, SHORT_PASSWORD_MESSAGE)
    .max(
      MAX_PASSWORD_LENGTH,
      `Shorten the password to ${MAX_PASSWORD_LENGTH} characters or fewer`,
    ),
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: `Enter your password` }),
})

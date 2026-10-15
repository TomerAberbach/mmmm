import { z } from 'zod'
import { EDUCATOR_NAME, freeTextSchema } from './free-text.ts'

export const MIN_PASSWORD_LENGTH = 10
export const MAX_PASSWORD_LENGTH = 128
export const CONFIRMATION_EXPIRES_IN_DAYS = 3
export const RESET_EXPIRES_IN_HOURS = 1

// The longest address RFC 5321 allows
export const MAX_EMAIL_LENGTH = 254

export const INVALID_EMAIL_MESSAGE = `Enter an email address like name@school.org`
const SHORT_PASSWORD_MESSAGE = `Enter a password of at least ${MIN_PASSWORD_LENGTH} characters`

export const emailSchema = z
  .email({ error: INVALID_EMAIL_MESSAGE })
  .max(MAX_EMAIL_LENGTH, INVALID_EMAIL_MESSAGE)

const newPasswordSchema = z
  .string({ error: SHORT_PASSWORD_MESSAGE })
  .min(MIN_PASSWORD_LENGTH, SHORT_PASSWORD_MESSAGE)
  .max(
    MAX_PASSWORD_LENGTH,
    `Shorten the password to ${MAX_PASSWORD_LENGTH} characters or fewer`,
  )

export const nameSchema = z.object({ name: freeTextSchema(EDUCATOR_NAME) })

export const signUpSchema = nameSchema.extend({
  email: emailSchema,
  password: newPasswordSchema,
})

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: `Enter your password` }),
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z.object({
  token: z.string(),
  password: newPasswordSchema,
})

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: `Enter your current password` }),
  newPassword: newPasswordSchema,
})

const SECURITY_CODE_MESSAGE = `Enter the 6-digit code from your authenticator app`
export const INCORRECT_CODE_MESSAGE = `That code is incorrect or expired. Enter the code your app shows now`

// Accepts the spaces and hyphens some apps show inside the code
const securityCodeSchema = z
  .string({ error: SECURITY_CODE_MESSAGE })
  .transform(code => code.replaceAll(/[\s-]/gu, ``))
  .pipe(z.string().regex(/^\d{6}$/u, SECURITY_CODE_MESSAGE))

export const securityCodeFormSchema = z.object({ code: securityCodeSchema })

export const recoveryCodeSchema = z.object({
  code: z
    .string({ error: `Enter one of your recovery codes` })
    .trim()
    .min(1, `Enter one of your recovery codes`),
})

export const confirmPasswordSchema = z.object({
  password: z.string({ error: `Enter your password` }),
})

import { RateLimiterRes } from 'rate-limiter-flexible'
import type { RateLimiterMemory } from 'rate-limiter-flexible'
import { MAX_EMAIL_LENGTH } from './auth-forms.ts'

// Resolves to the refusal once the key has used up its points. The limiter
// throws its refusal, so this turns it into a value
export const tryConsume = async (
  limiter: RateLimiterMemory,
  key: string,
): Promise<RateLimiterRes | undefined> => {
  try {
    await limiter.consume(key)
    return undefined
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      return error
    }
    throw error
  }
}

// Counts each address the same way in every limit. Better Auth accepts longer
// addresses than RFC 5321 allows, so a longer one counts by its first
// `MAX_EMAIL_LENGTH` characters, which bounds the counters' keys
export const normalizeEmail = (email: string): string =>
  email.trim().toLowerCase().slice(0, MAX_EMAIL_LENGTH)

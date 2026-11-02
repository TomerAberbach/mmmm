import { ipKeyGenerator } from 'express-rate-limit'
import { RateLimiterRes } from 'rate-limiter-flexible'
import type { RateLimiterMemory } from 'rate-limiter-flexible'
import { MAX_EMAIL_LENGTH } from './auth-forms.ts'
import { CLIENT_IP_HEADER } from './client-ip.ts'

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

export type Counted = { limiter: RateLimiterMemory; key: string }

// Counts the request in each limit, in order, and resolves to the first
// refusal. A refused request costs no limit an attempt, so the limits counted
// before the refusal get theirs back
export const consumeAll = async (
  entries: Counted[],
): Promise<RateLimiterRes | undefined> => {
  const counted: Counted[] = []
  for (const entry of entries) {
    const refusal = await tryConsume(entry.limiter, entry.key)
    if (refusal) {
      await Promise.all(counted.map(refund))
      return refusal
    }
    counted.push(entry)
  }
  return undefined
}

// Rewarding a key whose window has ended would start a new window with an
// extra attempt
export const refund = async ({ limiter, key }: Counted): Promise<void> => {
  const counts = await limiter.get(key)
  if (counts && counts.consumedPoints > 0) {
    await limiter.reward(key, 1)
  }
}

// Without the header, every request would share one IP address's count, so a
// request without it fails instead. IPv6 addresses count per /56 network, as
// the app-wide limit does
export const readClientIp = (headers: Headers | undefined): string => {
  const ip = headers?.get(CLIENT_IP_HEADER)
  if (!ip) {
    throw new Error(
      `Pass the request's headers, so the limits can count the client's IP address`,
    )
  }
  return ipKeyGenerator(ip)
}

// Such as "Try again in 5 minutes"
export const describeWait = (msBeforeNext: number): string => {
  const minutes = Math.max(1, Math.ceil(msBeforeNext / 60_000))
  return `Try again in ${minutes} ${minutes === 1 ? `minute` : `minutes`}`
}
